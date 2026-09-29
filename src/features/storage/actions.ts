"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  MATERIALS_BUCKET,
  completeUploadSchema,
  uploadIntentSchema,
} from "./schemas";

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

/**
 * Intent upload: validasi + signed upload URL. File TIDAK lewat server —
 * browser PUT langsung ke URL ini (two-step upload).
 */
export async function requestUpload(input: {
  material_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}): Promise<{ bucket: string; path: string; token: string }> {
  const parsed = uploadIntentSchema.safeParse(input);
  if (!parsed.success) throw new Error("VALIDATION_ERROR: file tidak valid");

  await requirePermission("material.update");
  const supabase = await createClient();
  const path = `materials/${parsed.data.material_id}/${randomUUID()}-${sanitize(parsed.data.filename)}`;
  const { data, error } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data)
    throw new Error(`Gagal membuat upload URL: ${error?.message}`);
  return { bucket: MATERIALS_BUCKET, path: data.path, token: data.token };
}

/** Catat metadata setelah browser selesai PUT ke signed URL. */
export async function completeUpload(input: {
  material_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}): Promise<void> {
  const parsed = completeUploadSchema.safeParse(input);
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: metadata file tidak valid");

  await requirePermission("material.update");
  const supabase = await createClient();
  const { error } = await supabase.from("material_files").insert({
    material_id: parsed.data.material_id,
    storage_bucket: MATERIALS_BUCKET,
    storage_path: parsed.data.storage_path,
    original_name: parsed.data.original_name,
    mime_type: parsed.data.mime_type,
    size_bytes: parsed.data.size_bytes,
  });
  if (error) throw new Error(`Gagal mencatat file: ${error.message}`);
  revalidatePath(`/materials/${parsed.data.material_id}`);
}

/** Signed download URL (60 menit) setelah RLS memastikan akses materi. */
export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("material_files")
    .select("id, storage_bucket, storage_path, material_id")
    .eq("id", fileId)
    .single();
  if (!file) throw new Error("NOT_FOUND: file tidak ada");
  const { data, error } = await supabase.storage
    .from(file.storage_bucket)
    .createSignedUrl(file.storage_path, 3600);
  if (error || !data)
    throw new Error(`Gagal membuat download URL: ${error?.message}`);
  return data.signedUrl;
}
