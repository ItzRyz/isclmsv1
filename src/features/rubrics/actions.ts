"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { addItemSchema, createRubricSchema } from "./schemas";

export async function createRubric(formData: FormData): Promise<void> {
  const parsed = createRubricSchema.safeParse({
    assignment_id: formData.get("assignment_id"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    max_score: formData.get("max_score"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data rubrik tidak valid");

  await requirePermission("assignment.update");
  const supabase = await createClient();
  const { error } = await supabase.from("rubrics").insert(parsed.data);
  if (error) throw new Error(`Gagal membuat rubrik: ${error.message}`);
  revalidatePath(`/assignments/${parsed.data.assignment_id}`);
}

export async function deleteRubric(formData: FormData): Promise<void> {
  const assignmentId = String(formData.get("assignment_id") ?? "");
  await requirePermission("assignment.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("rubrics")
    .delete()
    .eq("id", String(formData.get("rubric_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus rubrik: ${error.message}`);
  revalidatePath(`/assignments/${assignmentId}`);
}

export async function addRubricItem(formData: FormData): Promise<void> {
  const parsed = addItemSchema.safeParse({
    rubric_id: formData.get("rubric_id"),
    criterion: formData.get("criterion"),
    description: formData.get("description") || null,
    max_points: formData.get("max_points"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data kriteria tidak valid");

  await requirePermission("assignment.update");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("rubric_items")
    .select("position")
    .eq("rubric_id", parsed.data.rubric_id)
    .order("position", { ascending: false })
    .limit(1)
    .single();
  const { error } = await supabase.from("rubric_items").insert({
    ...parsed.data,
    position: (last?.position ?? -1) + 1,
  });
  if (error) throw new Error(`Gagal menambah kriteria: ${error.message}`);
  revalidatePath("/assignments");
}

export async function deleteRubricItem(formData: FormData): Promise<void> {
  const assignmentId = String(formData.get("assignment_id") ?? "");
  await requirePermission("assignment.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("rubric_items")
    .delete()
    .eq("id", String(formData.get("item_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus kriteria: ${error.message}`);
  revalidatePath(`/assignments/${assignmentId}`);
}
