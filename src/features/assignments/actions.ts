"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAssignmentSchema, updateAssignmentSchema } from "./schemas";

export async function createAssignment(formData: FormData): Promise<void> {
  const parsed = createAssignmentSchema.safeParse({
    course_id: formData.get("course_id"),
    module_id: formData.get("module_id") || null,
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
    type: formData.get("type"),
    submission_type: formData.get("submission_type"),
    available_from: formData.get("available_from") || null,
    due_at: formData.get("due_at"),
    allow_late_submission: formData.get("allow_late_submission") === "on",
    late_until: formData.get("late_until") || null,
    max_score: formData.get("max_score"),
    revision_allowed: formData.get("revision_allowed") === "on",
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data tugas tidak valid");

  const { userId } = await requirePermission("assignment.create");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .insert({ ...parsed.data, status: "DRAFT", created_by: userId })
    .select("id, course_id")
    .single();
  if (error) throw new Error(`Gagal membuat tugas: ${error.message}`);
  revalidatePath(`/courses/${data.course_id}`);
  void data;
}

export async function updateAssignment(formData: FormData): Promise<void> {
  const parsed = updateAssignmentSchema.safeParse({
    assignment_id: formData.get("assignment_id"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
    type: formData.get("type"),
    submission_type: formData.get("submission_type"),
    available_from: formData.get("available_from") || null,
    due_at: formData.get("due_at"),
    allow_late_submission: formData.get("allow_late_submission") === "on",
    late_until: formData.get("late_until") || null,
    max_score: formData.get("max_score"),
    revision_allowed: formData.get("revision_allowed") === "on",
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data tugas tidak valid");

  await requirePermission("assignment.update");
  const supabase = await createClient();
  const { assignment_id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("assignments")
    .update(rest)
    .eq("id", assignment_id);
  if (error) throw new Error(`Gagal mengubah tugas: ${error.message}`);
  revalidatePath(`/assignments/${assignment_id}`);
}

export async function publishAssignment(formData: FormData): Promise<void> {
  const assignmentId = String(formData.get("assignment_id") ?? "");
  await requirePermission("assignment.publish");
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({ status: "PUBLISHED" })
    .eq("id", assignmentId)
    .eq("status", "DRAFT");
  if (error) throw new Error(`Gagal publish tugas: ${error.message}`);
  revalidatePath(`/assignments/${assignmentId}`);
}

export async function archiveAssignment(formData: FormData): Promise<void> {
  const assignmentId = String(formData.get("assignment_id") ?? "");
  await requirePermission("assignment.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({ status: "ARCHIVED" })
    .eq("id", assignmentId);
  if (error) throw new Error(`Gagal mengarsipkan tugas: ${error.message}`);
  revalidatePath(`/assignments/${assignmentId}`);
}

export async function deleteAssignment(formData: FormData): Promise<void> {
  const assignmentId = String(formData.get("assignment_id") ?? "");
  await requirePermission("assignment.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) throw new Error(`Gagal menghapus tugas: ${error.message}`);
  revalidatePath("/learning");
}
