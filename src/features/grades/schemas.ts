import { z } from "zod";

export const componentSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_]+$/, "Kode huruf/angka/underscore"),
  name: z.string().trim().min(2).max(120),
  max_score: z.coerce.number().positive().max(1000000),
  default_weight: z.coerce.number().min(0).max(10000),
});

export const weightSchema = z.object({
  academic_period_id: z.string().uuid(),
  course_id: z.string().uuid().nullish(),
  division_id: z.string().uuid().nullish(),
  grade_component_id: z.string().uuid(),
  weight: z.coerce.number().min(0).max(10000),
});
