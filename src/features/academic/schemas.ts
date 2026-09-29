import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(32)
  .regex(/^[A-Z0-9-]+$/, "Kode hanya huruf/angka/strip");

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal format YYYY-MM-DD")
  .nullish();

const base = {
  name: z.string().trim().min(3).max(120),
  code: codeSchema,
  start_date: dateSchema,
  end_date: dateSchema,
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
};

export const createBatchSchema = z.object(base).omit({ status: true });
export const updateBatchSchema = z
  .object({ batch_id: z.string().uuid(), ...base })
  .refine(
    (v) => !v.start_date || !v.end_date || v.start_date <= v.end_date,
    "Tanggal mulai harus <= tanggal selesai",
  );

export const createPeriodSchema = z.object(base).omit({ status: true });
export const updatePeriodSchema = z
  .object({ period_id: z.string().uuid(), ...base })
  .refine(
    (v) => !v.start_date || !v.end_date || v.start_date <= v.end_date,
    "Tanggal mulai harus <= tanggal selesai",
  );
