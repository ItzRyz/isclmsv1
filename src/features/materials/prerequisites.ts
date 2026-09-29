"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const prereqSchema = z.object({
  material_id: z.string().uuid(),
  prerequisite_id: z.string().uuid(),
});

type MaterialCourse = {
  modules: { course_id: string } | { course_id: string }[] | null;
};

async function courseOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  materialId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("materials")
    .select("modules(course_id)")
    .eq("id", materialId)
    .single();
  const mod = (data as unknown as MaterialCourse | null)?.modules;
  const first = Array.isArray(mod) ? mod[0] : mod;
  return first?.course_id ?? null;
}

/** Cegah siklus: pastikan target bukan prereq (transitif) dari material. */
async function wouldCycle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  materialId: string,
  prerequisiteId: string,
): Promise<boolean> {
  const seen = new Set<string>([materialId]);
  let frontier = [prerequisiteId];
  while (frontier.length > 0) {
    if (frontier.some((id) => seen.has(id))) return true;
    const { data } = await supabase
      .from("material_prerequisites")
      .select("prerequisite_material_id")
      .in("material_id", frontier);
    for (const id of frontier) seen.add(id);
    frontier = ((data ?? []) as { prerequisite_material_id: string }[]).map(
      (r) => r.prerequisite_material_id,
    );
  }
  return false;
}

export async function addPrerequisite(formData: FormData): Promise<void> {
  const parsed = prereqSchema.safeParse({
    material_id: formData.get("material_id"),
    prerequisite_id: formData.get("prerequisite_id"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  if (parsed.data.material_id === parsed.data.prerequisite_id) {
    throw new Error(
      "VALIDATION_ERROR: materi tidak bisa mensyaratkan dirinya sendiri",
    );
  }

  await requirePermission("material.update");
  const supabase = await createClient();
  const [courseA, courseB] = await Promise.all([
    courseOf(supabase, parsed.data.material_id),
    courseOf(supabase, parsed.data.prerequisite_id),
  ]);
  if (!courseA || !courseB || courseA !== courseB) {
    throw new Error("VALIDATION_ERROR: prasyarat harus dari course yang sama");
  }
  if (
    await wouldCycle(
      supabase,
      parsed.data.material_id,
      parsed.data.prerequisite_id,
    )
  ) {
    throw new Error("VALIDATION_ERROR: prasyarat menyebabkan siklus");
  }
  const { error } = await supabase.from("material_prerequisites").insert({
    material_id: parsed.data.material_id,
    prerequisite_material_id: parsed.data.prerequisite_id,
  });
  if (error) throw new Error(`Gagal menambah prasyarat: ${error.message}`);
  revalidatePath(`/materials/${parsed.data.material_id}`);
}

export async function removePrerequisite(formData: FormData): Promise<void> {
  const parsed = prereqSchema.safeParse({
    material_id: formData.get("material_id"),
    prerequisite_id: formData.get("prerequisite_id"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");

  await requirePermission("material.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("material_prerequisites")
    .delete()
    .eq("material_id", parsed.data.material_id)
    .eq("prerequisite_material_id", parsed.data.prerequisite_id);
  if (error) throw new Error(`Gagal menghapus prasyarat: ${error.message}`);
  revalidatePath(`/materials/${parsed.data.material_id}`);
}

/** Daftar prasyarat yang belum diselesaikan user (kosong = terbuka). */
export async function unmetPrerequisites(
  materialId: string,
  userId: string,
): Promise<{ id: string; title: string }[]> {
  const supabase = await createClient();
  const { data: prereqs } = await supabase
    .from("material_prerequisites")
    .select(
      "prerequisite_material_id, materials!material_prerequisites_prerequisite_material_id_fkey(id, title)",
    )
    .eq("material_id", materialId);
  const rows = (prereqs ?? []) as {
    prerequisite_material_id: string;
    materials:
      { id: string; title: string } | { id: string; title: string }[] | null;
  }[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.prerequisite_material_id);
  const { data: done } = await supabase
    .from("material_progress")
    .select("material_id")
    .eq("user_id", userId)
    .in("material_id", ids)
    .not("completed_at", "is", null);
  const doneSet = new Set(
    ((done ?? []) as { material_id: string }[]).map((d) => d.material_id),
  );
  return rows
    .filter((r) => !doneSet.has(r.prerequisite_material_id))
    .map((r) => {
      const joined = Array.isArray(r.materials) ? r.materials[0] : r.materials;
      return {
        id: r.prerequisite_material_id,
        title: joined?.title ?? r.prerequisite_material_id,
      };
    });
}
