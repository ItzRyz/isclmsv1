import { z } from "zod";

export const updateOrganizationSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).nullish(),
  logo_path: z.string().trim().max(500).nullish(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
