import { z } from "zod";

export const createGroupSchema = z.object({
  assignment_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
});

export const groupMemberSchema = z.object({
  group_id: z.string().uuid(),
  user_id: z.string().uuid(),
});
