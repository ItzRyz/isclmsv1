import { z } from "zod";

export const CERTIFICATES_BUCKET = "certificates";

export const issueSchema = z.object({
  user_id: z.string().uuid(),
  division_id: z.string().uuid().nullish(),
  academic_period_id: z.string().uuid().nullish(),
  program_name: z.string().trim().min(3).max(200),
  issuer_name: z.string().trim().min(3).max(120),
});
