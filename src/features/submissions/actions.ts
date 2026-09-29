"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { decideSubmitStatus, isEditableStatus } from "./status";
import {
  SUBMISSIONS_BUCKET,
  draftSchema,
  submitSchema,
  uploadIntentSchema,
} from "./schemas";

async function sessionUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

async function loadAssignment(assignmentId: string) {
  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select(
      "id, type, submission_type, status, due_at, allow_late_submission, late_until",
    )
    .eq("id", assignmentId)
    .single();
  if (!assignment) throw new Error("NOT_FOUND: tugas tidak ada");
  if (assignment.status !== "PUBLISHED") {
    throw new Error("NOT_OPEN: tugas belum/sudah tidak dibuka");
  }
  return { supabase, assignment };
}

/** Autosave draf teks (tidak mengubah status final). */
export async function saveDraft(formData: FormData): Promise<void> {
  const parsed = draftSchema.safeParse({
    assignment_id: formData.get("assignment_id"),
    text_content: formData.get("text_content") || null,
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const userId = await sessionUserId();
  const { supabase, assignment } = await loadAssignment(
    parsed.data.assignment_id,
  );
  if (assignment.type !== "INDIVIDUAL") {
    throw new Error("VALIDATION_ERROR: tugas ini berkelompok");
  }

  const { data: existing } = await supabase
    .from("submissions")
    .select("id, status")
    .eq("assignment_id", parsed.data.assignment_id)
    .eq("user_id", userId)
    .single();
  if (existing && !isEditableStatus(existing.status as string)) {
    throw new Error("LOCKED: submission sudah final/dinilai");
  }
  const { error } = existing
    ? await supabase
        .from("submissions")
        .update({
          text_content: parsed.data.text_content,
          last_saved_at: new Date().toISOString(),
          status: "DRAFT",
        })
        .eq("id", existing.id)
    : await supabase.from("submissions").insert({
        assignment_id: parsed.data.assignment_id,
        user_id: userId,
        text_content: parsed.data.text_content,
        last_saved_at: new Date().toISOString(),
        status: "DRAFT",
        version: 1,
      });
  if (error) throw new Error(`Gagal menyimpan draf: ${error.message}`);
}

/** Intent upload file jawaban (signed URL, browser PUT langsung). */
export async function requestSubmissionUpload(input: {
  assignment_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}): Promise<{ path: string; token: string }> {
  const parsed = uploadIntentSchema.safeParse(input);
  if (!parsed.success) throw new Error("VALIDATION_ERROR: file tidak valid");
  const userId = await sessionUserId();
  const { supabase } = await loadAssignment(parsed.data.assignment_id);
  const path = `submissions/${parsed.data.assignment_id}/${userId}/${randomUUID()}-${sanitize(parsed.data.filename)}`;
  const { data, error } = await supabase.storage
    .from(SUBMISSIONS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data)
    throw new Error(`Gagal membuat upload URL: ${error?.message}`);
  return { path: data.path, token: data.token };
}

/**
 * Submit final: status ditentukan server (SUBMITTED/LATE), versi naik.
 * Idempoten terhadap klik ganda via cek status final.
 */
export async function submitFinal(input: {
  assignment_id: string;
  text_content?: string | null;
  files?: {
    path: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
  }[];
}): Promise<{ status: string }> {
  const parsed = submitSchema.safeParse({
    assignment_id: input.assignment_id,
    text_content: input.text_content ?? null,
    files: input.files ?? [],
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const userId = await sessionUserId();
  const { supabase, assignment } = await loadAssignment(
    parsed.data.assignment_id,
  );
  if (assignment.type !== "INDIVIDUAL") {
    throw new Error("VALIDATION_ERROR: tugas ini berkelompok");
  }
  if (
    assignment.submission_type === "TEXT" &&
    (!parsed.data.text_content || parsed.data.text_content.length === 0) &&
    parsed.data.files.length === 0
  ) {
    throw new Error("VALIDATION_ERROR: isi jawaban teks dulu");
  }
  if (
    (assignment.submission_type === "FILE" ||
      assignment.submission_type === "TEXT_AND_FILE") &&
    parsed.data.files.length === 0 &&
    (!parsed.data.text_content || assignment.submission_type === "FILE")
  ) {
    if (assignment.submission_type === "FILE") {
      throw new Error("VALIDATION_ERROR: lampirkan file jawaban");
    }
  }

  // Idempotensi: bila sudah final, kembalikan status berjalan.
  const { data: existing } = await supabase
    .from("submissions")
    .select("id, status, version")
    .eq("assignment_id", parsed.data.assignment_id)
    .eq("user_id", userId)
    .single();
  if (existing && !isEditableStatus(existing.status as string)) {
    return { status: existing.status as string };
  }

  const outcome = decideSubmitStatus(
    {
      due_at: assignment.due_at as string,
      allow_late_submission: assignment.allow_late_submission as boolean,
      late_until: (assignment.late_until as string | null) ?? null,
    },
    Date.now(),
  );

  const now = new Date().toISOString();
  let submissionId: string;
  if (existing) {
    const { error } = await supabase
      .from("submissions")
      .update({
        text_content: parsed.data.text_content,
        status: outcome,
        submitted_at: now,
        last_saved_at: now,
        version: ((existing.version as number) ?? 1) + 1,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Gagal submit: ${error.message}`);
    submissionId = existing.id as string;
  } else {
    const { data, error } = await supabase
      .from("submissions")
      .insert({
        assignment_id: parsed.data.assignment_id,
        user_id: userId,
        text_content: parsed.data.text_content,
        status: outcome,
        submitted_at: now,
        last_saved_at: now,
        version: 1,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Gagal submit: ${error?.message}`);
    submissionId = data.id as string;
  }

  for (const f of parsed.data.files) {
    const { error } = await supabase.from("submission_files").insert({
      submission_id: submissionId,
      bucket: SUBMISSIONS_BUCKET,
      storage_path: f.path,
      original_name: f.original_name,
      mime_type: f.mime_type,
      size_bytes: f.size_bytes,
    });
    if (error) throw new Error(`Gagal mencatat file: ${error.message}`);
  }
  revalidatePath(`/assignments/${parsed.data.assignment_id}`);
  return { status: outcome };
}
