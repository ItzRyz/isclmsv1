import { z } from "zod";

const datetimeLocal = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
    message: "Tanggal tidak valid",
  })
  .transform((v) => (v === "" ? null : new Date(v).toISOString()));

const base = {
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).nullish(),
  type: z.string().trim().min(2).max(32),
  time_limit_seconds: z.coerce.number().int().positive().max(86400).nullish(),
  max_attempts: z.coerce.number().int().min(1).max(100),
  shuffle_questions: z.coerce.boolean(),
  shuffle_options: z.coerce.boolean(),
  passing_score: z.coerce.number().min(0).max(1000000).nullish(),
  is_graded: z.coerce.boolean(),
  available_from: datetimeLocal.nullish(),
  due_at: datetimeLocal.nullish(),
};

export const createQuizSchema = z.object({
  course_id: z.string().uuid(),
  module_id: z.string().uuid().nullish(),
  ...base,
});

export const updateQuizSchema = z.object({
  quiz_id: z.string().uuid(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  ...base,
});

export const addQuizQuestionSchema = z.object({
  quiz_id: z.string().uuid(),
  question_id: z.string().uuid(),
  points: z.coerce.number().min(0).max(1000000),
});
