import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(16)
  .regex(/^[A-Z0-9]+$/, "Kode hanya huruf/angka tanpa spasi");

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Slug hanya huruf kecil, angka, strip");

export const createDivisionSchema = z.object({
  name: z.string().trim().min(3).max(120),
  code: codeSchema,
  slug: slugSchema,
  description: z.string().trim().max(2000).nullish(),
});

export const updateDivisionSchema = createDivisionSchema.extend({
  division_id: z.string().uuid(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
});

export const divisionMemberSchema = z.object({
  division_id: z.string().uuid(),
  user_id: z.string().uuid(),
  membership_type: z.enum(["MEMBER", "COORDINATOR", "MENTOR"]),
});

export const coordinatorAssignSchema = z.object({
  division_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role_id: z.string().uuid(),
});

/** Kode divisi -> kode peran koordinator yang sah. */
export const DIVISION_COORDINATOR_ROLE: Record<string, string> = {
  WEB: "WEB_COORDINATOR",
  ML: "ML_COORDINATOR",
  UIUX: "UIUX_COORDINATOR",
};
