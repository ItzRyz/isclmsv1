"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createQuestionSchema, updateQuestionSchema } from "./schemas";

export async function createQuestion(formData: FormData): Promise<void> {
  const options: { text: string; is_correct: boolean }[] = [];
  for (let i = 0; i < 6; i++) {
    const text = String(formData.get(`opt_${i}`) ?? "").trim();
    if (!text) continue;
    options.push({ text, is_correct: formData.get(`correct_${i}`) === "on" });
  }
  const parsed = createQuestionSchema.safeParse({
    question_type: formData.get("question_type"),
    prompt: formData.get("prompt"),
    explanation: formData.get("explanation") || null,
    difficulty: formData.get("difficulty") || null,
    options,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data soal tidak valid");

  const { userId } = await requirePermission("quiz.create");
  const supabase = await createClient();
  const { data: q, error } = await supabase
    .from("questions")
    .insert({
      question_type: parsed.data.question_type,
      prompt: parsed.data.prompt,
      explanation: parsed.data.explanation,
      difficulty: parsed.data.difficulty,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !q) throw new Error(`Gagal membuat soal: ${error?.message}`);
  const { error: optError } = await supabase.from("question_options").insert(
    parsed.data.options.map((o, i) => ({
      question_id: (q as { id: string }).id,
      option_text: o.text,
      is_correct: o.is_correct,
      position: i,
    })),
  );
  if (optError) {
    await supabase
      .from("questions")
      .delete()
      .eq("id", (q as { id: string }).id);
    throw new Error(`Gagal menyimpan opsi: ${optError.message}`);
  }
  revalidatePath("/quizzes/bank");
}

export async function updateQuestion(formData: FormData): Promise<void> {
  const parsed = updateQuestionSchema.safeParse({
    question_id: formData.get("question_id"),
    prompt: formData.get("prompt"),
    explanation: formData.get("explanation") || null,
    difficulty: formData.get("difficulty") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data soal tidak valid");

  await requirePermission("quiz.update");
  const supabase = await createClient();
  const { question_id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("questions")
    .update(rest)
    .eq("id", question_id);
  if (error) throw new Error(`Gagal mengubah soal: ${error.message}`);
  revalidatePath("/quizzes/bank");
}

export async function deleteQuestion(formData: FormData): Promise<void> {
  await requirePermission("quiz.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", String(formData.get("question_id") ?? ""));
  if (error) throw new Error(`Gagal menghapus soal: ${error.message}`);
  revalidatePath("/quizzes/bank");
}
