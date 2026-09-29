import { z } from "zod";

const dateOnly = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
    message: "Tanggal tidak valid",
  })
  .transform((v) => (v === "" ? null : v));

export const createPeriodSchema = z.object({
  academic_period_id: z.string().uuid().nullish(),
  type: z.enum(["MONTHLY", "SEMESTER"]),
  name: z.string().trim().min(3).max(160),
  start_date: dateOnly.nullish(),
  end_date: dateOnly.nullish(),
  metric: z.enum(["POINTS", "GRADES", "MIXED"]),
});
