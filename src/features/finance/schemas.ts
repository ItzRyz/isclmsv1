import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/, "Kode huruf/angka/strip/underscore"),
  type: z.enum(["CASH", "BANK", "EWALLET"]),
  opening_balance: z.coerce.number().min(0).max(1000000000000),
  is_active: z.coerce.boolean(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["INCOME", "EXPENSE"]),
});
