import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Slug hanya huruf kecil, angka, strip");

const datetimeLocal = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
    message: "Jadwal tidak valid",
  })
  .transform((v) => (v === "" ? null : new Date(v).toISOString()));

export const MATERIAL_TYPES = ["TEXT", "LINK", "FILE", "VIDEO"] as const;

export const createMaterialSchema = z.object({
  module_id: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  slug: slugSchema,
  type: z.enum(MATERIAL_TYPES),
  description: z.string().trim().max(4000).nullish(),
  content_text: z.string().trim().max(50000).nullish(),
  url: z.string().trim().url("URL tidak valid").max(2000).nullish(),
  estimated_minutes: z.coerce.number().int().positive().max(100000).nullish(),
  is_required: z.coerce.boolean(),
  scheduled_at: datetimeLocal.nullish(),
});

export const updateMaterialSchema = z.object({
  material_id: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).nullish(),
  content_text: z.string().trim().max(50000).nullish(),
  estimated_minutes: z.coerce.number().int().positive().max(100000).nullish(),
  is_required: z.coerce.boolean(),
  scheduled_at: datetimeLocal.nullish(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});
