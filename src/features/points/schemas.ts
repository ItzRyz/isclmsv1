import { z } from "zod";

export const POINT_TYPES = [
  "ACHIEVEMENT",
  "ASSIGNMENT_BONUS",
  "ATTENDANCE",
  "COMPETITION",
  "CORRECTION",
  "MANUAL",
] as const;

export const awardSchema = z.object({
  user_id: z.string().uuid(),
  amount: z.coerce
    .number()
    .int()
    .min(-100000)
    .max(100000)
    .refine((n) => n !== 0, {
      message: "amount tidak boleh 0",
    }),
  point_type: z.enum(POINT_TYPES),
  source_type: z.string().trim().min(2).max(64),
  source_id: z.string().uuid().nullish(),
  description: z.string().trim().min(3).max(500),
});
