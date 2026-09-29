import { z } from "zod";

const itemScore = z.object({
  item_id: z.string().uuid(),
  points: z.coerce.number().min(0).max(100000),
});

export const gradeSchema = z.object({
  submission_id: z.string().uuid(),
  score: z.coerce.number().min(0).max(100000),
  items: z.array(itemScore).max(100).default([]),
  feedback: z.string().trim().max(8000).nullish(),
});
