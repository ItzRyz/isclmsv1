"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createCourseSchema, updateCourseSchema } from "./schemas";

export async function createCourse(formData: FormData): Promise<void> {
  const parsed = createCourseSchema.safeParse({
    division_id: formData.get("division_id"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    code: formData.get("code") || null,
    description: formData.get("description") || null,
    difficulty: formData.get("difficulty") || null,
    estimated_hours: formData.get("estimated_hours") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data course tidak valid");

  const { userId } = await requirePermission("course.create");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({ ...parsed.data, created_by: userId, status: "DRAFT" })
    .select("id")
    .single();
  if (error) throw new Error(`Gagal membuat course: ${error.message}`);
  revalidatePath("/learning");
  void data;
}

export async function updateCourse(formData: FormData): Promise<void> {
  const parsed = updateCourseSchema.safeParse({
    course_id: formData.get("course_id"),
    name: formData.get("name"),
    code: formData.get("code") || null,
    description: formData.get("description") || null,
    difficulty: formData.get("difficulty") || null,
    estimated_hours: formData.get("estimated_hours") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data course tidak valid");

  await requirePermission("course.update");
  const supabase = await createClient();
  const { course_id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("courses")
    .update(rest)
    .eq("id", course_id);
  if (error) throw new Error(`Gagal mengubah course: ${error.message}`);
  revalidatePath(`/courses/${course_id}`);
  revalidatePath("/learning");
}

/** Publish = DRAFT -> PUBLISHED + published_at (butuh course.update). */
export async function publishCourse(formData: FormData): Promise<void> {
  const courseId = String(formData.get("course_id") ?? "");
  await requirePermission("course.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ status: "PUBLISHED", published_at: new Date().toISOString() })
    .eq("id", courseId)
    .eq("status", "DRAFT");
  if (error) throw new Error(`Gagal publish course: ${error.message}`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/learning");
}

export async function archiveCourse(formData: FormData): Promise<void> {
  const courseId = String(formData.get("course_id") ?? "");
  await requirePermission("course.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ status: "ARCHIVED" })
    .eq("id", courseId);
  if (error) throw new Error(`Gagal mengarsipkan course: ${error.message}`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/learning");
}

export async function deleteCourse(formData: FormData): Promise<void> {
  const courseId = String(formData.get("course_id") ?? "");
  await requirePermission("course.delete");
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw new Error(`Gagal menghapus course: ${error.message}`);
  revalidatePath("/learning");
}
