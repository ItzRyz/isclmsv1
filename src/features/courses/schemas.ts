import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Slug hanya huruf kecil, angka, strip");

export const createCourseSchema = z.object({
  division_id: z.string().uuid(),
  name: z.string().trim().min(3).max(160),
  slug: slugSchema,
  code: z.string().trim().max(32).nullish(),
  description: z.string().trim().max(4000).nullish(),
  difficulty: z.string().trim().max(32).nullish(),
  estimated_hours: z.coerce.number().int().positive().max(10000).nullish(),
});

export const updateCourseSchema = z.object({
  course_id: z.string().uuid(),
  name: z.string().trim().min(3).max(160),
  code: z.string().trim().max(32).nullish(),
  description: z.string().trim().max(4000).nullish(),
  difficulty: z.string().trim().max(32).nullish(),
  estimated_hours: z.coerce.number().int().positive().max(10000).nullish(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});
