import { z } from "zod";

export const profileEditSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().max(160).nullish(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Username huruf/angka/underscore")
    .nullish(),
  phone: z.string().trim().max(32).nullish(),
  student_number: z.string().trim().max(64).nullish(),
});

export const statusSchema = z.object({
  user_id: z.string().uuid(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
});

export const roleChangeSchema = z.object({
  user_id: z.string().uuid(),
  role_id: z.string().uuid(),
});
