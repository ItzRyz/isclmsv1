import { z } from "zod";

const dateOnly = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
    message: "Tanggal tidak valid",
  })
  .transform((v) => (v === "" ? null : v.slice(0, 10)));

export const transactionSchema = z.object({
  account_id: z.string().uuid(),
  category_id: z.string().uuid().nullish(),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().positive().max(1000000000000),
  description: z.string().trim().min(3).max(500),
  transaction_date: dateOnly.nullish(),
  reference: z.string().trim().max(200).nullish(),
});
