"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  createModuleSchema,
  moveModuleSchema,
  updateModuleSchema,
} from "./schemas";

export async function createModule(formData: FormData): Promise<void> {
  const parsed = createModuleSchema.safeParse({
    course_id: formData.get("course_id"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data modul tidak valid");

  await requirePermission("module.create");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("modules")
    .select("position")
    .eq("course_id", parsed.data.course_id)
    .order("position", { ascending: false })
    .limit(1)
    .single();
  const position = (last?.position ?? -1) + 1;
  const { error } = await supabase.from("modules").insert({
    ...parsed.data,
    position,
    status: "DRAFT",
  });
  if (error) throw new Error(`Gagal membuat modul: ${error.message}`);
  revalidatePath(`/courses/${parsed.data.course_id}`);
}

export async function updateModule(formData: FormData): Promise<void> {
  const parsed = updateModuleSchema.safeParse({
    module_id: formData.get("module_id"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data modul tidak valid");

  await requirePermission("module.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.module_id);
  if (error) throw new Error(`Gagal mengubah modul: ${error.message}`);
  revalidatePath("/courses");
}

export async function deleteModule(formData: FormData): Promise<void> {
  const moduleId = String(formData.get("module_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  await requirePermission("module.delete");
  const supabase = await createClient();
  const { error } = await supabase.from("modules").delete().eq("id", moduleId);
  if (error) throw new Error(`Gagal menghapus modul: ${error.message}`);
  revalidatePath(`/courses/${courseId}`);
}

/** Tukar posisi dengan tetangga atas/bawah dalam course yang sama. */
export async function moveModule(formData: FormData): Promise<void> {
  const parsed = moveModuleSchema.safeParse({
    module_id: formData.get("module_id"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR: arah tidak valid");

  await requirePermission("module.update");
  const supabase = await createClient();
  const { data: mod } = await supabase
    .from("modules")
    .select("id, course_id, position")
    .eq("id", parsed.data.module_id)
    .single();
  if (!mod) throw new Error("Modul tidak ditemukan.");

  const neighborQuery = supabase
    .from("modules")
    .select("id, position")
    .eq("course_id", mod.course_id);
  const { data: neighbor } =
    parsed.data.direction === "up"
      ? await neighborQuery
          .lt("position", mod.position)
          .order("position", { ascending: false })
          .limit(1)
          .single()
      : await neighborQuery
          .gt("position", mod.position)
          .order("position", { ascending: true })
          .limit(1)
          .single();
  if (!neighbor) return;

  // Tukar via posisi sementara untuk melewati unique(course_id, position).
  const { error: e1 } = await supabase
    .from("modules")
    .update({ position: -1 })
    .eq("id", mod.id);
  if (e1) throw new Error(`Gagal reorder: ${e1.message}`);
  const { error: e2 } = await supabase
    .from("modules")
    .update({ position: mod.position })
    .eq("id", neighbor.id);
  if (e2) throw new Error(`Gagal reorder: ${e2.message}`);
  const { error: e3 } = await supabase
    .from("modules")
    .update({ position: neighbor.position })
    .eq("id", mod.id);
  if (e3) throw new Error(`Gagal reorder: ${e3.message}`);
  revalidatePath(`/courses/${mod.course_id}`);
}
