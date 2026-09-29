"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { componentSchema, weightSchema } from "./schemas";

async function orgId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "study-club")
    .single();
  if (!data) throw new Error("Organisasi belum ada.");
  return data.id as string;
}

export async function createComponent(formData: FormData): Promise<void> {
  const parsed = componentSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    max_score: formData.get("max_score"),
    default_weight: formData.get("default_weight"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data komponen tidak valid");

  await requirePermission("grade.create");
  const supabase = await createClient();
  const { error } = await supabase.from("grade_components").insert({
    ...parsed.data,
    organization_id: await orgId(),
  });
  if (error) throw new Error(`Gagal membuat komponen: ${error.message}`);
  revalidatePath("/grades/components");
}

export async function deleteComponent(formData: FormData): Promise<void> {
  await requirePermission("grade.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("grade_components")
    .delete()
    .eq("id", String(formData.get("component_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus komponen: ${error.message}`);
  revalidatePath("/grades/components");
}

/** Bobot per periode (+ opsional course/divisi), upsert per kombinasi unik. */
export async function setWeight(formData: FormData): Promise<void> {
  const parsed = weightSchema.safeParse({
    academic_period_id: formData.get("academic_period_id"),
    course_id: formData.get("course_id") || null,
    division_id: formData.get("division_id") || null,
    grade_component_id: formData.get("grade_component_id"),
    weight: formData.get("weight"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR: bobot tidak valid");

  await requirePermission("grade.update");
  const supabase = await createClient();
  // Cocokkan kombinasi (kolom nullable dibandingkan di JS).
  const { data: candidates } = await supabase
    .from("grade_weights")
    .select("id, course_id, division_id")
    .eq("academic_period_id", parsed.data.academic_period_id)
    .eq("grade_component_id", parsed.data.grade_component_id);
  const match = (
    (candidates ?? []) as {
      id: string;
      course_id: string | null;
      division_id: string | null;
    }[]
  ).find(
    (r) =>
      (r.course_id ?? null) === (parsed.data.course_id ?? null) &&
      (r.division_id ?? null) === (parsed.data.division_id ?? null),
  );
  if (match) {
    const { error } = await supabase
      .from("grade_weights")
      .update({ weight: parsed.data.weight })
      .eq("id", match.id);
    if (error) throw new Error(`Gagal menyimpan bobot: ${error.message}`);
  } else {
    const { error } = await supabase.from("grade_weights").insert({
      academic_period_id: parsed.data.academic_period_id,
      course_id: parsed.data.course_id,
      division_id: parsed.data.division_id,
      grade_component_id: parsed.data.grade_component_id,
      weight: parsed.data.weight,
    });
    if (error) throw new Error(`Gagal menyimpan bobot: ${error.message}`);
  }
  revalidatePath("/grades/components");
}
