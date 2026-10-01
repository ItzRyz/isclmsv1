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
    message: "Tanggal tidak valid",
  })
  .transform((v) => (v === "" ? null : new Date(v).toISOString()));

const base = {
  name: z.string().trim().min(3).max(160),
  slug: slugSchema,
  description: z.string().trim().max(4000).nullish(),
  starts_at: datetimeLocal.nullish(),
  ends_at: datetimeLocal.nullish(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
};

export const createCompetitionSchema = z.object({
  division_id: z.string().uuid().nullish(),
  ...base,
});

export const resultSchema = z.object({
  competition_id: z.string().uuid(),
  user_id: z.string().uuid(),
  rank: z.coerce.number().int().min(1).max(1000000),
  score: z.coerce.number().min(0).max(1000000),
  points: z.coerce.number().int().min(0).max(100000),
});
