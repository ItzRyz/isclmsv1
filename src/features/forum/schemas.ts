import { z } from "zod";

export const threadSchema = z.object({
  category_id: z.string().uuid(),
  course_id: z.string().uuid().nullish(),
  class_id: z.string().uuid().nullish(),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(10000),
});

export const postSchema = z.object({
  thread_id: z.string().uuid(),
  body: z.string().trim().min(1).max(10000),
});
