import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Slug hanya huruf kecil, angka, strip");

export const createModuleSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  slug: slugSchema,
  description: z.string().trim().max(2000).nullish(),
});

export const updateModuleSchema = z.object({
  module_id: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).nullish(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export const moveModuleSchema = z.object({
  module_id: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});
