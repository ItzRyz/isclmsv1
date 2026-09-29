import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(32)
  .regex(/^[A-Z0-9-]+$/, "Kode hanya huruf/angka/strip");

const optionalUuid = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().uuid().safeParse(v).success, {
    message: "Harus UUID atau kosong",
  })
  .transform((v) => (v === "" ? null : v));

export const createClassSchema = z.object({
  division_id: z.string().uuid(),
  batch_id: optionalUuid,
  academic_period_id: optionalUuid,
  name: z.string().trim().min(3).max(120),
  code: codeSchema,
  capacity: z.coerce.number().int().positive().max(10000).nullish(),
});

export const updateClassSchema = z.object({
  class_id: z.string().uuid(),
  name: z.string().trim().min(3).max(120),
  capacity: z.coerce.number().int().positive().max(10000).nullish(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
});

export const classMemberSchema = z.object({
  class_id: z.string().uuid(),
  user_id: z.string().uuid(),
});
