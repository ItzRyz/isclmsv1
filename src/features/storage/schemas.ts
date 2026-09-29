import { z } from "zod";

export const MATERIALS_BUCKET = "materials-private";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "video/mp4",
] as const;

export const uploadIntentSchema = z.object({
  material_id: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  mime_type: z.enum(ALLOWED_MIME),
  size_bytes: z.coerce.number().int().positive().max(MAX_FILE_BYTES),
});

export const completeUploadSchema = z.object({
  material_id: z.string().uuid(),
  storage_path: z.string().trim().min(1).max(500),
  original_name: z.string().trim().min(1).max(255),
  mime_type: z.enum(ALLOWED_MIME),
  size_bytes: z.coerce.number().int().positive().max(MAX_FILE_BYTES),
});
