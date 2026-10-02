"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  addQuizQuestionSchema,
  createQuizSchema,
  updateQuizSchema,
} from "./schemas";

function cleanFormData(formData: FormData): FormData {
  const clean = new FormData();
  for (const [key, value] of formData.entries()) {
    clean.append(key.replace(/^_\d+_/, ""), value);
  }
  return clean;
}

export async function createQuiz(formData: FormData): Promise<void> {
  const parsed = createQuizSchema.safeParse({
    course_id: formData.get("course_id"),
    module_id: formData.get("module_id") || null,
    title: formData.get("title"),
    description: formData.get("description") || null,
    type: formData.get("type"),
    time_limit_seconds: formData.get("time_limit_seconds") || null,
    max_attempts: formData.get("max_attempts"),
    shuffle_questions: formData.get("shuffle_questions") === "on",
    shuffle_options: formData.get("shuffle_options") === "on",
    passing_score: formData.get("passing_score") || null,
    is_graded: formData.get("is_graded") === "on",
    available_from: formData.get("available_from") || null,
    due_at: formData.get("due_at") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data kuis tidak valid");

  const { userId } = await requirePermission("quiz.create");
  const supabase = await createClient();
  const { error } = await supabase.from("quizzes").insert({
    ...parsed.data,
    status: "DRAFT",
    created_by: userId,
  });
  if (error) throw new Error(`Gagal membuat kuis: ${error.message}`);
  revalidatePath(`/courses/${parsed.data.course_id}`);
}

export async function updateQuiz(formData: FormData): Promise<void> {
  const parsed = updateQuizSchema.safeParse({
    quiz_id: formData.get("quiz_id"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    type: formData.get("type"),
    time_limit_seconds: formData.get("time_limit_seconds") || null,
    max_attempts: formData.get("max_attempts"),
    shuffle_questions: formData.get("shuffle_questions") === "on",
    shuffle_options: formData.get("shuffle_options") === "on",
    passing_score: formData.get("passing_score") || null,
    is_graded: formData.get("is_graded") === "on",
    available_from: formData.get("available_from") || null,
    due_at: formData.get("due_at") || null,
    status: formData.get("status"),
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data kuis tidak valid");

  await requirePermission("quiz.update");
  const supabase = await createClient();
  const { quiz_id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("quizzes")
    .update(rest)
    .eq("id", quiz_id);
  if (error) throw new Error(`Gagal mengubah kuis: ${error.message}`);
  revalidatePath(`/quizzes/${quiz_id}`);
}

export async function publishQuiz(formData: FormData): Promise<void> {
  const quizId = String(formData.get("quiz_id") ?? "");
  await requirePermission("quiz.publish");
  const supabase = await createClient();
  const { error } = await supabase
    .from("quizzes")
    .update({ status: "PUBLISHED" })
    .eq("id", quizId)
    .eq("status", "DRAFT");
  if (error) throw new Error(`Gagal publish kuis: ${error.message}`);
  revalidatePath(`/quizzes/${quizId}`);
}

export async function deleteQuiz(formData: FormData): Promise<void> {
  const quizId = String(formData.get("quiz_id") ?? "");
  await requirePermission("quiz.delete");
  const supabase = await createClient();
  const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
  if (error) throw new Error(`Gagal menghapus kuis: ${error.message}`);
  revalidatePath("/learning");
}

export async function addQuizQuestion(formData: FormData): Promise<void> {
  const clean = cleanFormData(formData);
  const parsed = addQuizQuestionSchema.safeParse({
    quiz_id: clean.get("quiz_id"),
    question_id: clean.get("question_id"),
    points: clean.get("points"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");

  await requirePermission("quiz.update");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("quiz_questions")
    .select("position")
    .eq("quiz_id", parsed.data.quiz_id)
    .order("position", { ascending: false })
    .limit(1)
    .single();
  const { error } = await supabase.from("quiz_questions").insert({
    ...parsed.data,
    position: (last?.position ?? -1) + 1,
  });
  if (error) throw new Error(`Gagal menambah soal: ${error.message}`);
  revalidatePath(`/quizzes/${parsed.data.quiz_id}`);
}

export async function removeQuizQuestion(formData: FormData): Promise<void> {
  const quizId = String(formData.get("quiz_id") ?? "");
  await requirePermission("quiz.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("quiz_questions")
    .delete()
    .eq("quiz_id", quizId)
    .eq("question_id", String(formData.get("question_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus soal: ${error.message}`);
  revalidatePath(`/quizzes/${quizId}`);
}
