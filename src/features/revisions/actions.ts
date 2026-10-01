"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { emailOwners } from "@/features/email/notify";
import { revisionRequestedTemplate } from "@/features/email/templates";
import { notifyMany } from "@/features/notifications/notify";
import { assertTransition } from "@/features/submissions/status";

const requestSchema = z.object({
  submission_id: z.string().uuid(),
  feedback: z.string().trim().min(1).max(8000),
});

const resubmitSchema = z.object({
  submission_id: z.string().uuid(),
  text_content: z.string().trim().max(50000).nullish(),
});

/** Mentor meminta revisi: butuh revision_allowed + transisi valid. */
export async function requestRevision(formData: FormData): Promise<void> {
  const parsed = requestSchema.safeParse({
    submission_id: formData.get("submission_id"),
    feedback: formData.get("feedback"),
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");

  const { userId } = await requirePermission("assignment.feedback");
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("submissions")
    .select(
      "id, status, user_id, assignment_group_id, assignments(revision_allowed)",
    )
    .eq("id", parsed.data.submission_id)
    .single();
  if (!sub) throw new Error("NOT_FOUND");
  const asg = sub.assignments as unknown as {
    revision_allowed: boolean | null;
  } | null;
  const allowed = Array.isArray(asg)
    ? asg[0]?.revision_allowed
    : asg?.revision_allowed;
  if (!allowed)
    throw new Error("VALIDATION_ERROR: tugas ini tidak mengizinkan revisi");
  assertTransition(sub.status as string, "REVISION_REQUIRED");

  const { error } = await supabase
    .from("submissions")
    .update({ status: "REVISION_REQUIRED" })
    .eq("id", parsed.data.submission_id);
  if (error) throw new Error(`Gagal meminta revisi: ${error.message}`);
  const { error: fbError } = await supabase.from("submission_feedback").insert({
    submission_id: parsed.data.submission_id,
    mentor_id: userId,
    body: `Revisi diminta:\n${parsed.data.feedback}`,
  });
  if (fbError) throw new Error(`Gagal menyimpan feedback: ${fbError.message}`);
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "submission.revision_request",
    entity_type: "submissions",
    entity_id: parsed.data.submission_id,
    old_values: { status: sub.status },
    new_values: { status: "REVISION_REQUIRED" },
  });
  const owners: string[] = [];
  if ((sub.user_id as string | null) ?? null)
    owners.push(sub.user_id as string);
  if (sub.assignment_group_id) {
    const { data: members } = await supabase
      .from("assignment_group_members")
      .select("user_id")
      .eq("assignment_group_id", sub.assignment_group_id as string);
    owners.push(
      ...((members ?? []) as { user_id: string }[]).map((m) => m.user_id),
    );
  }
  await notifyMany(supabase, owners, {
    type: "submission.revision_request",
    title: "Revisi diminta untuk submissionmu",
    entity_type: "submissions",
    entity_id: parsed.data.submission_id,
  }).catch(() => undefined);
  await emailOwners(supabase, owners, "submission.revision_request", (name) =>
    revisionRequestedTemplate({
      name,
      assignment: "tugas yang kamu kumpulkan",
    }),
  ).catch(() => undefined);
  revalidatePath("/assignments");
}

/** Pemilik submit ulang: arsipkan versi lama ke submission_revisions. */
export async function resubmit(formData: FormData): Promise<void> {
  const parsed = resubmitSchema.safeParse({
    submission_id: formData.get("submission_id"),
    text_content: formData.get("text_content") || null,
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const { data: sub } = await supabase
    .from("submissions")
    .select(
      "id, assignment_id, user_id, assignment_group_id, status, version, text_content, score, assignments(due_at, allow_late_submission, late_until, revision_allowed)",
    )
    .eq("id", parsed.data.submission_id)
    .single();
  if (!sub) throw new Error("NOT_FOUND");
  const mine =
    sub.user_id === user.id ||
    (await supabase
      .from("assignment_group_members")
      .select("user_id")
      .eq(
        "assignment_group_id",
        (sub.assignment_group_id as string | null) ?? "",
      )
      .eq("user_id", user.id)
      .single()
      .then((r) => !!r.data));
  if (!mine) throw new Error("FORBIDDEN: bukan pemilik submission");
  if ((sub.status as string) !== "REVISION_REQUIRED") {
    throw new Error("TRANSITION_INVALID: revisi tidak sedang diminta");
  }
  const asg = Array.isArray(sub.assignments)
    ? sub.assignments[0]
    : sub.assignments;
  if (!asg?.revision_allowed)
    throw new Error("VALIDATION_ERROR: revisi tidak diizinkan");

  // Submit ulang revisi melewati cek deadline (mentor yang meminta).
  const { error: revError } = await supabase
    .from("submission_revisions")
    .insert({
      submission_id: parsed.data.submission_id,
      version: sub.version as number,
      text_content: (sub.text_content as string | null) ?? null,
      submitted_at: new Date().toISOString(),
      score: (sub.score as number | null) ?? null,
      status: sub.status as string,
    });
  if (revError)
    throw new Error(`Gagal mengarsipkan revisi: ${revError.message}`);

  const { error } = await supabase
    .from("submissions")
    .update({
      text_content: parsed.data.text_content,
      status: "RESUBMITTED",
      submitted_at: new Date().toISOString(),
      version: ((sub.version as number) ?? 1) + 1,
    })
    .eq("id", parsed.data.submission_id);
  if (error) throw new Error(`Gagal submit ulang: ${error.message}`);
  revalidatePath("/assignments");
}
