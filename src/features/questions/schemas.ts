import { z } from "zod";

const optionSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  is_correct: z.boolean(),
});

export const createQuestionSchema = z
  .object({
    question_type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]),
    prompt: z.string().trim().min(3).max(8000),
    explanation: z.string().trim().max(8000).nullish(),
    difficulty: z.string().trim().max(32).nullish(),
    options: z.array(optionSchema).min(2).max(10),
  })
  .refine((v) => {
    const correct = v.options.filter((o) => o.is_correct).length;
    if (v.question_type === "SINGLE_CHOICE") return correct === 1;
    if (v.question_type === "TRUE_FALSE") {
      return v.options.length === 2 && correct === 1;
    }
    return correct >= 1;
  }, "Jumlah jawaban benar tidak sesuai tipe soal");

export const updateQuestionSchema = z.object({
  question_id: z.string().uuid(),
  prompt: z.string().trim().min(3).max(8000),
  explanation: z.string().trim().max(8000).nullish(),
  difficulty: z.string().trim().max(32).nullish(),
});
