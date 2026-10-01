import { z } from "zod";

const datetimeLocal = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
    message: "Tanggal tidak valid",
  })
  .transform((v) => (v === "" ? null : new Date(v).toISOString()));

export const announcementSchema = z.object({
  scope: z
    .string()
    .trim()
    .regex(
      /^(organization|(division|class):[0-9a-f-]{36})$/i,
      "Scope tidak valid",
    ),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(10000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  published_at: datetimeLocal.nullish(),
  expires_at: datetimeLocal.nullish(),
});
