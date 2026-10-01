"use server";

import { createClient } from "@/lib/supabase/server";
import { gradeAnswers } from "./grading";

/**
 * Nilai attempt SUBMITTED milik sendiri (atau penilai). Dipanggil otomatis
 * di akhir submitAttempt bila quiz.is_graded; manual bila tidak.
 */
export async function gradeAttempt(
  attemptId: string,
): Promise<{ score: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id, user_id, status")
    .eq("id", attemptId)
    .single();
  if (!attempt) throw new Error("NOT_FOUND");
  const mine = (attempt as { user_id: string }).user_id === user.id;
  if (!mine) {
    const { data: allowed } = await supabase.rpc("has_permission", {
      p_user_id: user.id,
      p_permission_code: "quiz.grade",
    });
    if (!allowed) throw new Error("FORBIDDEN: bukan attempt milikmu");
  }
  if ((attempt as { status: string }).status !== "SUBMITTED") {
    throw new Error(`LOCKED: status ${(attempt as { status: string }).status}`);
  }

  const { data: qq } = await supabase
    .from("quiz_questions")
    .select(
      "question_id, points, questions(id, question_type, question_options(id, is_correct))",
    )
    .eq("quiz_id", (attempt as { quiz_id: string }).quiz_id);
  const { data: answers } = await supabase
    .from("quiz_answers")
    .select("question_id, selected_option_ids")
    .eq("attempt_id", attemptId);
  const answerMap = new Map(
    (
      (answers ?? []) as {
        question_id: string;
        selected_option_ids: string[];
      }[]
    ).map((a) => [a.question_id, a.selected_option_ids]),
  );

  const inputs = (
    (qq ?? []) as unknown as {
      question_id: string;
      points: number;
      questions:
        | {
            id: string;
            question_type: string;
            question_options: { id: string; is_correct: boolean }[];
          }
        | {
            id: string;
            question_type: string;
            question_options: { id: string; is_correct: boolean }[];
          }[]
        | null;
    }[]
  ).map((r) => {
    const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
    const correct = (q?.question_options ?? [])
      .filter((o) => o.is_correct)
      .map((o) => o.id);
    return {
      questionId: r.question_id,
      questionType: q?.question_type ?? "SINGLE_CHOICE",
      points: Number(r.points),
      correctOptionIds: correct,
      selectedOptionIds: answerMap.get(r.question_id) ?? [],
    };
  });

  const result = gradeAnswers(inputs);
  for (const pq of result.perQuestion) {
    await supabase
      .from("quiz_answers")
      .update({ is_correct: pq.correct, points_awarded: pq.awarded })
      .eq("attempt_id", attemptId)
      .eq("question_id", pq.questionId);
  }
  const { error } = await supabase
    .from("quiz_attempts")
    .update({ score: result.total, status: "GRADED" })
    .eq("id", attemptId)
    .eq("status", "SUBMITTED");
  if (error) throw new Error(`Gagal menyimpan nilai: ${error.message}`);
  await supabase.rpc("check_achievements").then(
    () => undefined,
    () => undefined,
  );
  return { score: result.total };
}
