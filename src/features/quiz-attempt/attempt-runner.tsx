"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveAnswers, submitAttempt } from "./actions";
import { QuizTimer } from "./quiz-timer";

export type AttemptQuestion = {
  id: string;
  prompt: string;
  type: string;
  points: number;
  options: { id: string; text: string }[];
  saved: string[];
};

export function AttemptRunner({
  attemptId,
  quizId,
  deadlineMs,
  questions,
}: {
  attemptId: string;
  quizId: string;
  deadlineMs: number | null;
  questions: AttemptQuestion[];
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.saved])),
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(qid: string, oid: string, multi: boolean): void {
    setAnswers((prev) => {
      const cur = prev[qid] ?? [];
      const next = multi
        ? cur.includes(oid)
          ? cur.filter((x) => x !== oid)
          : [...cur, oid]
        : [oid];
      const snapshot = { ...prev, [qid]: next };
      void saveAnswers({
        attempt_id: attemptId,
        answers: Object.entries(snapshot).map(([question_id, selected]) => ({
          question_id,
          selected,
        })),
      }).catch(() => undefined);
      return snapshot;
    });
  }

  async function finish(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await saveAnswers({
        attempt_id: attemptId,
        answers: Object.entries(answers).map(([question_id, selected]) => ({
          question_id,
          selected,
        })),
      }).catch(() => undefined);
      const res = await submitAttempt(attemptId);
      setDone(`Terkirim (${res.status}). Penilaian menyusul.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit gagal.");
    } finally {
      setBusy(false);
    }
    void quizId;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <QuizTimer deadlineMs={deadlineMs} onExpire={() => void finish()} />
        <span className="text-muted-foreground text-sm">
          Jawaban tersimpan otomatis
        </span>
      </div>
      {questions.map((q, i) => {
        const multi = q.type === "MULTIPLE_CHOICE";
        return (
          <div key={q.id} className="flex flex-col gap-2 rounded-md border p-3">
            <p className="font-medium">
              {i + 1}. {q.prompt}{" "}
              <span className="text-muted-foreground">({q.points} poin)</span>
            </p>
            {q.options.map((o) => {
              const checked = (answers[q.id] ?? []).includes(o.id);
              return (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={q.id}
                    checked={checked}
                    onChange={() => toggle(q.id, o.id, multi)}
                  />
                  {o.text}
                </label>
              );
            })}
          </div>
        );
      })}
      {error ? <span className="text-destructive text-sm">{error}</span> : null}
      {done ? <span className="text-primary text-sm">{done}</span> : null}
      {!done ? (
        <Button onClick={() => void finish()} disabled={busy}>
          {busy ? "Mengirim…" : "Kumpulkan jawaban"}
        </Button>
      ) : null}
    </div>
  );
}
