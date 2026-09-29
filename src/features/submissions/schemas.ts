import { z } from "zod";

export const SUBMISSIONS_BUCKET = "assignment-submissions";

export const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024;

export const ALLOWED_SUBMISSION_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "text/plain",
  "image/png",
  "image/jpeg",
] as const;

export const draftSchema = z.object({
  assignment_id: z.string().uuid(),
  text_content: z.string().trim().max(50000).nullish(),
});

const fileMeta = z.object({
  path: z.string().min(1).max(500),
  original_name: z.string().min(1).max(255),
  mime_type: z.enum(ALLOWED_SUBMISSION_MIME),
  size_bytes: z.coerce.number().int().positive().max(MAX_SUBMISSION_BYTES),
});

export const submitSchema = z.object({
  assignment_id: z.string().uuid(),
  text_content: z.string().trim().max(50000).nullish(),
  files: z.array(fileMeta).max(10).default([]),
});

export const uploadIntentSchema = z.object({
  assignment_id: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  mime_type: z.enum(ALLOWED_SUBMISSION_MIME),
  size_bytes: z.coerce.number().int().positive().max(MAX_SUBMISSION_BYTES),
});
