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
  type: z.string().trim().min(2).max(32),
  starts_at: datetimeLocal,
  ends_at: datetimeLocal,
  location: z.string().trim().max(300).nullish(),
  capacity: z.coerce.number().int().positive().max(100000).nullish(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
};

export const createEventSchema = z
  .object({ division_id: z.string().uuid().nullish(), ...base })
  .refine((v) => !v.starts_at || !v.ends_at || v.starts_at < v.ends_at, {
    message: "ends_at harus setelah starts_at",
  });

export const updateEventSchema = z
  .object({ event_id: z.string().uuid(), ...base })
  .refine((v) => !v.starts_at || !v.ends_at || v.starts_at < v.ends_at, {
    message: "ends_at harus setelah starts_at",
  });
