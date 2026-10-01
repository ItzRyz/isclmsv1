"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { emailOwners } from "@/features/email/notify";
import { gradePublishedTemplate } from "@/features/email/templates";
import { notifyMany } from "@/features/notifications/notify";
import { assertTransition } from "@/features/submissions/status";
import { gradeSchema } from "./schemas";

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * Penilai boleh menilai bila: cakupan divisinya cocok, ATAU pemilik
 * submission sekelas dengannya (jalur mentor CLASS), ATAU akses global/org.
 */
async function requireGradeScope(
  supabase: Supa,
  graderId: string,
  submission: {
    assignment_id: string;
    user_id: string | null;
    assignment_group_id: string | null;
  },
): Promise<void> {
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, courses(division_id)")
    .eq("id", submission.assignment_id)
    .single();
  const courses = (
    assignment as {
      courses: { division_id: string } | { division_id: string }[] | null;
    } | null
  )?.courses;
  const course = Array.isArray(courses) ? courses[0] : courses;
  try {
    await requirePermission(
      "assignment.grade",
      course ? { divisionId: course.division_id } : {},
    );
    return;
  } catch {
    // Lanjut ke jalur mentor di bawah.
  }

  const ownerIds: string[] = [];
  if (submission.user_id) ownerIds.push(submission.user_id);
  if (submission.assignment_group_id) {
    const { data: members } = await supabase
      .from("assignment_group_members")
      .select("user_id")
      .eq("assignment_group_id", submission.assignment_group_id);
    ownerIds.push(
      ...((members ?? []) as { user_id: string }[]).map((m) => m.user_id),
    );
  }
  if (ownerIds.length === 0)
    throw new Error("FORBIDDEN: pemilik submission tak dikenal");

  const { data: graderClasses } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", graderId)
    .is("left_at", null)
    .eq("status", "ACTIVE");
  const gids = new Set(
    ((graderClasses ?? []) as { class_id: string }[]).map((c) => c.class_id),
  );
  if (gids.size === 0) throw new Error("FORBIDDEN: di luar cakupan kelas");
  const { data: overlap } = await supabase
    .from("class_members")
    .select("class_id")
    .in("user_id", ownerIds)
    .in("class_id", [...gids])
    .is("left_at", null)
    .eq("status", "ACTIVE")
    .limit(1);
  if (!overlap || overlap.length === 0) {
    throw new Error("FORBIDDEN: pemilik di luar kelas yang diajar");
  }
}

export async function gradeSubmission(formData: FormData): Promise<void> {
  const items: { item_id: string; points: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("pts_") && String(value).trim() !== "") {
      items.push({ item_id: key.slice(4), points: Number(value) });
    }
  }
  const parsed = gradeSchema.safeParse({
    submission_id: formData.get("submission_id"),
    score: formData.get("score"),
    items,
    feedback: formData.get("feedback") || null,
  });
  if (!parsed.success)
    throw new Error("VALIDATION_ERROR: data nilai tidak valid");

  const { userId } = await requirePermission("assignment.grade");
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("submissions")
    .select(
      "id, assignment_id, user_id, assignment_group_id, status, version, assignments(max_score)",
    )
    .eq("id", parsed.data.submission_id)
    .single();
  if (!sub) throw new Error("NOT_FOUND: submission tidak ada");
  await requireGradeScope(supabase, userId, {
    assignment_id: sub.assignment_id as string,
    user_id: (sub.user_id as string | null) ?? null,
    assignment_group_id: (sub.assignment_group_id as string | null) ?? null,
  });

  const maxScore = Number(
    (Array.isArray(sub.assignments) ? sub.assignments[0] : sub.assignments)
      ?.max_score ?? 100,
  );
  if (parsed.data.score > maxScore) {
    throw new Error(`VALIDATION_ERROR: skor melebihi maks ${maxScore}`);
  }
  if (parsed.data.items.length > 0) {
    const { data: rubricItems } = await supabase
      .from("rubric_items")
      .select("id, max_points, rubrics!inner(assignment_id)")
      .eq("rubrics.assignment_id", sub.assignment_id as string);
    const caps = new Map(
      ((rubricItems ?? []) as { id: string; max_points: number }[]).map((r) => [
        r.id,
        Number(r.max_points),
      ]),
    );
    for (const it of parsed.data.items) {
      const cap = caps.get(it.item_id);
      if (cap === undefined)
        throw new Error("VALIDATION_ERROR: kriteria rubrik tak dikenal");
      if (it.points > cap) {
        throw new Error(
          `VALIDATION_ERROR: poin melebihi maks kriteria (${cap})`,
        );
      }
    }
  }
  assertTransition(sub.status as string, "GRADED");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("submissions")
    .update({
      score: parsed.data.score,
      graded_at: now,
      graded_by: userId,
      status: "GRADED",
    })
    .eq("id", parsed.data.submission_id);
  if (error) throw new Error(`Gagal menilai: ${error.message}`);

  const breakdown = parsed.data.items
    .map((it) => `${it.item_id}:${it.points}`)
    .join(", ");
  const body = [
    `Nilai: ${parsed.data.score}/${maxScore}`,
    breakdown ? `Rincian rubrik: ${breakdown}` : null,
    parsed.data.feedback,
  ]
    .filter(Boolean)
    .join("\n");
  const { error: fbError } = await supabase.from("submission_feedback").insert({
    submission_id: parsed.data.submission_id,
    mentor_id: userId,
    body,
  });
  if (fbError) throw new Error(`Gagal menyimpan feedback: ${fbError.message}`);

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "submission.grade",
    entity_type: "submissions",
    entity_id: parsed.data.submission_id,
    old_values: { status: sub.status },
    new_values: { status: "GRADED", score: parsed.data.score },
  });
  const owners: string[] = [];
  if (sub.user_id) owners.push(sub.user_id as string);
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
    type: "submission.graded",
    title: `Nilai keluar: ${parsed.data.score}/${maxScore}`,
    entity_type: "submissions",
    entity_id: parsed.data.submission_id,
  }).catch(() => undefined);
  await emailOwners(supabase, owners, "submission.graded", (name) =>
    gradePublishedTemplate({
      name,
      assignment: "tugas yang kamu kumpulkan",
      score: parsed.data.score,
      maxScore,
    }),
  ).catch(() => undefined);
  revalidatePath("/assignments");
}
