import { z } from "zod";

export const entrySchema = z.object({
  user_id: z.string().uuid(),
  academic_period_id: z.string().uuid(),
  course_id: z.string().uuid().nullish(),
  grade_component_id: z.string().uuid(),
  source_type: z.string().trim().min(2).max(64),
  source_id: z.string().uuid().nullish(),
  raw_score: z.coerce.number().min(0).max(1000000),
});
