"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createMaterialSchema, updateMaterialSchema } from "./schemas";

export async function createMaterial(formData: FormData): Promise<void> {
  const parsed = createMaterialSchema.safeParse({
    module_id: formData.get("module_id"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    type: formData.get("type"),
    description: formData.get("description") || null,
    content_text: formData.get("content_text") || null,
    url: formData.get("url") || null,
    estimated_minutes: formData.get("estimated_minutes") || null,
    is_required: formData.get("is_required") === "on",
    scheduled_at: formData.get("scheduled_at") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data materi tidak valid");
  if (parsed.data.type === "LINK" && !parsed.data.url) {
    throw new Error("VALIDATION_ERROR: materi LINK wajib punya URL");
  }

  const { userId } = await requirePermission("material.create");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .insert({
      module_id: parsed.data.module_id,
      title: parsed.data.title,
      slug: parsed.data.slug,
      type: parsed.data.type,
      description: parsed.data.description,
      content_text: parsed.data.content_text,
      estimated_minutes: parsed.data.estimated_minutes,
      is_required: parsed.data.is_required,
      scheduled_at: parsed.data.scheduled_at,
      status: "DRAFT",
      created_by: userId,
    })
    .select("id, module_id")
    .single();
  if (error) throw new Error(`Gagal membuat materi: ${error.message}`);

  if (parsed.data.type === "LINK" && parsed.data.url) {
    const { error: linkError } = await supabase.from("material_links").insert({
      material_id: data.id,
      url: parsed.data.url,
      title: parsed.data.title,
    });
    if (linkError)
      throw new Error(`Gagal menyimpan link: ${linkError.message}`);
  }
  const { data: mod } = await supabase
    .from("modules")
    .select("course_id")
    .eq("id", data.module_id)
    .single();
  revalidatePath(`/courses/${mod?.course_id ?? ""}`);
}

export async function updateMaterial(formData: FormData): Promise<void> {
  const parsed = updateMaterialSchema.safeParse({
    material_id: formData.get("material_id"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    content_text: formData.get("content_text") || null,
    estimated_minutes: formData.get("estimated_minutes") || null,
    is_required: formData.get("is_required") === "on",
    scheduled_at: formData.get("scheduled_at") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data materi tidak valid");

  await requirePermission("material.update");
  const supabase = await createClient();
  const { material_id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("materials")
    .update(rest)
    .eq("id", material_id);
  if (error) throw new Error(`Gagal mengubah materi: ${error.message}`);
  revalidatePath(`/materials/${material_id}`);
}

/** Publish sekarang; bila scheduled_at di masa depan, tayang mengikuti jadwal di app. */
export async function publishMaterial(formData: FormData): Promise<void> {
  const materialId = String(formData.get("material_id") ?? "");
  await requirePermission("material.publish");
  const supabase = await createClient();
  const { error } = await supabase
    .from("materials")
    .update({ status: "PUBLISHED", published_at: new Date().toISOString() })
    .eq("id", materialId);
  if (error) throw new Error(`Gagal publish materi: ${error.message}`);
  revalidatePath(`/materials/${materialId}`);
}

export async function deleteMaterial(formData: FormData): Promise<void> {
  const materialId = String(formData.get("material_id") ?? "");
  await requirePermission("material.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("materials")
    .delete()
    .eq("id", materialId);
  if (error) throw new Error(`Gagal menghapus materi: ${error.message}`);
  revalidatePath("/learning");
}
