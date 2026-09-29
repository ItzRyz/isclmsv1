import { z } from "zod";

export const createRubricSchema = z.object({
  assignment_id: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullish(),
  max_score: z.coerce.number().positive().max(100000),
});

export const addItemSchema = z.object({
  rubric_id: z.string().uuid(),
  criterion: z.string().trim().min(2).max(300),
  description: z.string().trim().max(2000).nullish(),
  max_points: z.coerce.number().min(0).max(100000),
});
