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
  title: z.string().trim().min(3).max(200),
  slug: slugSchema,
  description: z.string().trim().max(8000).nullish(),
  type: z.enum(["INDIVIDUAL", "GROUP"]),
  submission_type: z.enum(["TEXT", "FILE", "TEXT_AND_FILE"]),
  available_from: datetimeLocal.nullish(),
  due_at: datetimeLocal,
  allow_late_submission: z.coerce.boolean(),
  late_until: datetimeLocal.nullish(),
  max_score: z.coerce.number().positive().max(100000),
  revision_allowed: z.coerce.boolean(),
};

export const createAssignmentSchema = z
  .object({
    course_id: z.string().uuid(),
    module_id: z.string().uuid().nullish(),
    ...base,
  })
  .refine((v) => !v.late_until || !v.due_at || v.late_until >= v.due_at, {
    message: "late_until harus >= due_at",
  })
  .refine((v) => v.allow_late_submission || !v.late_until, {
    message: "late_until butuh allow_late_submission",
  });

export const updateAssignmentSchema = z
  .object({
    assignment_id: z.string().uuid(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    ...base,
  })
  .refine((v) => !v.late_until || !v.due_at || v.late_until >= v.due_at, {
    message: "late_until harus >= due_at",
  });
