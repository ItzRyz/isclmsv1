import { z } from "zod";

export const scaleSchema = z
  .object({
    code: z.string().trim().toUpperCase().min(1).max(32),
    letter: z.string().trim().min(1).max(8),
    min_score: z.coerce.number().min(0).max(100),
    max_score: z.coerce.number().min(0).max(100),
    is_passing: z.coerce.boolean(),
    remark: z.string().trim().max(500).nullish(),
  })
  .refine((v) => v.min_score <= v.max_score, "min harus <= maks");
