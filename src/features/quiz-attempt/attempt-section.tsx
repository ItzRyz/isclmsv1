import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  attemptDeadline,
  orderOptions,
  orderQuestions,
  startAttemptForm,
} from "./actions";
import { AttemptRunner, type AttemptQuestion } from "./attempt-runner";

type QuizInfo = {
  id: string;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  time_limit_seconds: number | null;
  max_attempts: number;
};

/** Area pengerjaan: mulai, lanjutkan, riwayat attempt. */
export async function AttemptSection({ quiz }: { quiz: QuizInfo }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mulai mengerjakan</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Masuk dulu untuk mengerjakan kuis.
        </CardContent>
      </Card>
    );
  }

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, attempt_number, status, score, started_at")
    .eq("quiz_id", quiz.id)
    .eq("user_id", user.id)
    .order("attempt_number", { ascending: false });
  const list = (attempts ?? []) as {
    id: string;
    attempt_number: number;
    status: string;
    score: number | null;
    started_at: string;
  }[];
  const active = list.find((a) => a.status === "IN_PROGRESS") ?? null;
  const remaining = quiz.max_attempts - list.length;

  let questions: AttemptQuestion[] = [];
  let deadlineMs: number | null = null;
  if (active) {
    const { data: qq } = await supabase
      .from("quiz_questions")
      .select(
        "position, points, questions(id, question_type, prompt, question_options(id, option_text, position))",
      )
      .eq("quiz_id", quiz.id)
      .order("position");
    const { data: saved } = await supabase
      .from("quiz_answers")
      .select("question_id, selected_option_ids")
      .eq("attempt_id", active.id);
    const savedMap = new Map(
      (
        (saved ?? []) as {
          question_id: string;
          selected_option_ids: string[];
        }[]
      ).map((s) => [s.question_id, s.selected_option_ids]),
    );
    const raw = (
      (qq ?? []) as unknown as {
        position: number;
        points: number;
        questions:
          | {
              id: string;
              question_type: string;
              prompt: string;
              question_options: {
                id: string;
                option_text: string;
                position: number;
              }[];
            }
          | {
              id: string;
              question_type: string;
              prompt: string;
              question_options: {
                id: string;
                option_text: string;
                position: number;
              }[];
            }[]
          | null;
      }[]
    )
      .map((r) => ({
        ...r,
        questions: Array.isArray(r.questions)
          ? (r.questions[0] ?? null)
          : r.questions,
      }))
      .filter((r) => r.questions)
      .map((r) => ({
        id: r.questions!.id,
        prompt: r.questions!.prompt,
        type: r.questions!.question_type,
        points: Number(r.points),
        options: orderOptions(
          [...r.questions!.question_options].sort(
            (a, b) => a.position - b.position,
          ),
          active.id,
          r.questions!.id,
          quiz.shuffle_options,
        ).map((o) => ({ id: o.id, text: o.option_text })),
        saved: savedMap.get(r.questions!.id) ?? [],
      }));
    questions = orderQuestions(raw, active.id, quiz.shuffle_questions);
    deadlineMs = attemptDeadline(active.started_at, quiz.time_limit_seconds);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Pengerjaan
          <Badge variant="secondary">
            {list.length}/{quiz.max_attempts} percobaan
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {active ? (
          <AttemptRunner
            attemptId={active.id}
            quizId={quiz.id}
            deadlineMs={deadlineMs}
            questions={questions}
          />
        ) : remaining > 0 ? (
          <form action={startAttemptForm}>
            <input type="hidden" name="quiz_id" value={quiz.id} />
            <Button type="submit">Mulai attempt #{list.length + 1}</Button>
          </form>
        ) : (
          <p className="text-muted-foreground text-sm">Kuota attempt habis.</p>
        )}
        {list.filter((a) => a.status !== "IN_PROGRESS").length > 0 ? (
          <div className="flex flex-col gap-1 border-t pt-2 text-sm">
            {list
              .filter((a) => a.status !== "IN_PROGRESS")
              .map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <span>Attempt #{a.attempt_number}</span>
                  <Badge>{a.status}</Badge>
                  {a.score != null ? (
                    <Badge variant="secondary">Nilai {a.score}</Badge>
                  ) : null}
                </div>
              ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
