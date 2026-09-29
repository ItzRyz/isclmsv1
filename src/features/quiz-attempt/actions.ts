"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { gradeAttempt } from "./grade";
import { seededShuffle } from "./shuffle";

const answerSchema = z.object({
  question_id: z.string().uuid(),
  selected: z.array(z.string().uuid()).max(20),
});

const saveSchema = z.object({
  attempt_id: z.string().uuid(),
  answers: z.array(answerSchema).max(200),
});

type Supa = Awaited<ReturnType<typeof createClient>>;

async function sessionUserId(supa: Supa): Promise<string> {
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

async function ownAttempt(supa: Supa, userId: string, attemptId: string) {
  const { data: attempt } = await supa
    .from("quiz_attempts")
    .select(
      "id, quiz_id, user_id, attempt_number, started_at, status, quizzes(time_limit_seconds, due_at, status, is_graded)",
    )
    .eq("id", attemptId)
    .single();
  if (!attempt || attempt.user_id !== userId) {
    throw new Error("FORBIDDEN: bukan attempt milikmu");
  }
  if (attempt.status !== "IN_PROGRESS") {
    throw new Error(`LOCKED: attempt sudah ${attempt.status}`);
  }
  const quizJoin = (
    attempt as unknown as {
      quizzes:
        | {
            time_limit_seconds: number | null;
            due_at: string | null;
            is_graded: boolean;
          }
        | {
            time_limit_seconds: number | null;
            due_at: string | null;
            is_graded: boolean;
          }[]
        | null;
    }
  ).quizzes;
  const quiz = Array.isArray(quizJoin) ? quizJoin[0] : quizJoin;
  return {
    id: attempt.id as string,
    quiz_id: attempt.quiz_id as string,
    started_at: attempt.started_at as string,
    quizzes: quiz ?? null,
  };
}

/** Batas waktu attempt (null = tanpa batas). */
export function attemptDeadline(
  startedAt: string,
  timeLimitSeconds: number | null,
): number | null {
  if (!timeLimitSeconds) return null;
  return new Date(startedAt).getTime() + timeLimitSeconds * 1000;
}

/** Mulai attempt baru: cek jendela + sisa kuota. Kembalikan id attempt. */
export async function startAttempt(quizId: string): Promise<string> {
  const supabase = await createClient();
  const userId = await sessionUserId(supabase);
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, status, available_from, due_at, max_attempts")
    .eq("id", quizId)
    .single();
  if (!quiz || quiz.status !== "PUBLISHED")
    throw new Error("NOT_OPEN: kuis belum dibuka");
  const now = Date.now();
  if (quiz.available_from && new Date(quiz.available_from).getTime() > now) {
    throw new Error("NOT_OPEN: kuis belum mulai");
  }
  if (quiz.due_at && new Date(quiz.due_at).getTime() <= now) {
    throw new Error("EXPIRED: kuis sudah ditutup");
  }
  const { data: existing } = await supabase
    .from("quiz_attempts")
    .select("id")
    .eq("quiz_id", quizId)
    .eq("user_id", userId);
  if ((existing ?? []).length >= (quiz.max_attempts as number)) {
    throw new Error("ATTEMPT_LIMIT_REACHED: kuota habis");
  }
  const { data: created, error } = await supabase
    .from("quiz_attempts")
    .insert({
      quiz_id: quizId,
      user_id: userId,
      attempt_number: (existing ?? []).length + 1,
      status: "IN_PROGRESS",
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Gagal memulai: ${error?.message}`);
  revalidatePath(`/quizzes/${quizId}`);
  return (created as { id: string }).id;
}

/** Simpan jawaban (hanya IN_PROGRESS milik sendiri; opsi divalidasi). */
export async function saveAnswers(input: {
  attempt_id: string;
  answers: { question_id: string; selected: string[] }[];
}): Promise<void> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const supabase = await createClient();
  const userId = await sessionUserId(supabase);
  await ownAttempt(supabase, userId, parsed.data.attempt_id);

  const qIds = parsed.data.answers.map((a) => a.question_id);
  const { data: options } = await supabase
    .from("question_options")
    .select("id, question_id")
    .in("question_id", qIds);
  const validByQ = new Map<string, Set<string>>();
  for (const o of (options ?? []) as { id: string; question_id: string }[]) {
    validByQ.set(
      o.question_id,
      (validByQ.get(o.question_id) ?? new Set()).add(o.id),
    );
  }
  for (const a of parsed.data.answers) {
    const valid = validByQ.get(a.question_id) ?? new Set<string>();
    const clean = a.selected.filter((id) => valid.has(id));
    const { error } = await supabase.from("quiz_answers").upsert(
      {
        attempt_id: parsed.data.attempt_id,
        question_id: a.question_id,
        selected_option_ids: clean,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "attempt_id,question_id" },
    );
    if (error) throw new Error(`Gagal menyimpan jawaban: ${error.message}`);
  }
}

/**
 * Submit final: tolak bila lewat time limit / due, tandai EXPIRED.
 * Penilaian menyusul P1-505 (status SUBMITTED).
 */
export async function submitAttempt(
  attemptId: string,
): Promise<{ status: string }> {
  const supabase = await createClient();
  const userId = await sessionUserId(supabase);
  const attempt = await ownAttempt(supabase, userId, attemptId);
  const quiz = attempt.quizzes;
  const now = Date.now();

  const deadline = attemptDeadline(
    attempt.started_at,
    quiz?.time_limit_seconds ?? null,
  );
  if (deadline !== null && now > deadline) {
    await supabase
      .from("quiz_attempts")
      .update({ status: "EXPIRED" })
      .eq("id", attemptId);
    throw new Error("EXPIRED: waktu habis");
  }
  if (quiz?.due_at && now > new Date(quiz.due_at).getTime()) {
    await supabase
      .from("quiz_attempts")
      .update({ status: "EXPIRED" })
      .eq("id", attemptId);
    throw new Error("EXPIRED: kuis sudah ditutup");
  }

  const { error } = await supabase
    .from("quiz_attempts")
    .update({ status: "SUBMITTED", submitted_at: new Date(now).toISOString() })
    .eq("id", attemptId)
    .eq("status", "IN_PROGRESS");
  if (error) throw new Error(`Gagal submit: ${error.message}`);
  revalidatePath("/quizzes");

  // Nilai otomatis bila flag menyala; gagal nilai -> tetap SUBMITTED
  // (tombol "Hitung nilai" di riwayat mencoba lagi).
  if (attempt.quizzes?.is_graded) {
    await gradeAttempt(attemptId).catch(() => undefined);
  }
  const { data: final } = await supabase
    .from("quiz_attempts")
    .select("status")
    .eq("id", attemptId)
    .single();
  return { status: (final?.status as string) ?? "SUBMITTED" };
}

/** Bungkus FormData untuk tombol mulai (revalidate terpusat di startAttempt). */
export async function startAttemptForm(formData: FormData): Promise<void> {
  await startAttempt(String(formData.get("quiz_id") ?? ""));
}
export function orderQuestions<T extends { id: string }>(
  questions: T[],
  attemptId: string,
  shuffle: boolean,
): T[] {
  return shuffle ? seededShuffle(questions, `q:${attemptId}`) : questions;
}

/** Urutan opsi tampil (acak deterministik bila flag menyala). */
export function orderOptions<T extends { id: string }>(
  options: T[],
  attemptId: string,
  questionId: string,
  shuffle: boolean,
): T[] {
  return shuffle
    ? seededShuffle(options, `o:${attemptId}:${questionId}`)
    : options;
}
