import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  addQuizQuestion,
  deleteQuiz,
  publishQuiz,
  removeQuizQuestion,
  updateQuiz,
} from "@/features/quizzes/actions";
import { AttemptSection } from "@/features/quiz-attempt/attempt-section";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: quiz } = await supabase
    .from("quizzes")
    .select(
      "id, course_id, title, description, type, time_limit_seconds, max_attempts, shuffle_questions, shuffle_options, passing_score, is_graded, available_from, due_at, status",
    )
    .eq("id", id)
    .single();
  if (!quiz) notFound();

  const { data: items } = await supabase
    .from("quiz_questions")
    .select("question_id, position, points, questions(prompt)")
    .eq("quiz_id", id)
    .order("position");
  const { data: bank } = await supabase
    .from("questions")
    .select("id, prompt")
    .order("created_at", { ascending: false })
    .limit(50);

  const canEdit = await can("quiz.update").catch(() => false);
  const canDelete = await can("quiz.delete").catch(() => false);
  const canPublish = await can("quiz.publish").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {quiz.title}
            <Badge variant="outline">{quiz.type}</Badge>
            <Badge>{quiz.status}</Badge>
          </CardTitle>
          <CardDescription>
            {quiz.description ?? "Tanpa deskripsi."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          {typeof quiz.time_limit_seconds === "number" ? (
            <Badge variant="outline">
              {Math.round(quiz.time_limit_seconds / 60)} mnt
            </Badge>
          ) : (
            <Badge variant="outline">Tanpa batas waktu</Badge>
          )}
          <Badge variant="outline">Maks {quiz.max_attempts}x coba</Badge>
          {quiz.shuffle_questions ? (
            <Badge variant="secondary">Acak soal</Badge>
          ) : null}
          {quiz.shuffle_options ? (
            <Badge variant="secondary">Acak opsi</Badge>
          ) : null}
          {typeof quiz.passing_score === "number" ? (
            <Badge variant="outline">Lulus ≥ {quiz.passing_score}</Badge>
          ) : null}
          <Badge variant={quiz.is_graded ? "default" : "secondary"}>
            {quiz.is_graded ? "Dinilai otomatis" : "Manual"}
          </Badge>
        </CardContent>
      </Card>

      <AttemptSection
        quiz={{
          id: quiz.id,
          shuffle_questions: quiz.shuffle_questions,
          shuffle_options: quiz.shuffle_options,
          time_limit_seconds: quiz.time_limit_seconds,
          max_attempts: quiz.max_attempts,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Soal ({((items ?? []) as unknown[]).length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {(
            (items ?? []) as {
              question_id: string;
              position: number;
              points: number;
              questions: { prompt: string } | { prompt: string }[] | null;
            }[]
          ).map((it) => {
            const q = Array.isArray(it.questions)
              ? it.questions[0]
              : it.questions;
            return (
              <div key={it.question_id} className="flex items-center gap-2">
                <Badge variant="outline">{it.position}</Badge>
                <span className="flex-1">{q?.prompt ?? it.question_id}</span>
                <Badge variant="outline">{it.points} poin</Badge>
                {canEdit ? (
                  <form action={removeQuizQuestion}>
                    <input type="hidden" name="quiz_id" value={quiz.id} />
                    <input
                      type="hidden"
                      name="question_id"
                      value={it.question_id}
                    />
                    <Button type="submit" size="sm" variant="ghost">
                      ✕
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })}
          {canEdit ? (
            <form action={addQuizQuestion} className="flex gap-2 border-t pt-3">
              <input type="hidden" name="quiz_id" value={quiz.id} />
              <select
                name="question_id"
                required
                defaultValue=""
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Pilih soal dari bank
                </option>
                {((bank ?? []) as { id: string; prompt: string }[]).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.prompt.slice(0, 60)}
                  </option>
                ))}
              </select>
              <Input
                name="points"
                type="number"
                min={0}
                step="any"
                defaultValue={1}
                className="w-24"
                required
              />
              <Button type="submit" size="sm">
                Tambah
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {canEdit || canPublish ? (
        <Card>
          <CardHeader>
            <CardTitle>Kelola kuis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {canEdit ? (
              <form action={updateQuiz} className="flex flex-col gap-3">
                <input type="hidden" name="quiz_id" value={quiz.id} />
                <Input
                  name="title"
                  defaultValue={quiz.title}
                  required
                  minLength={3}
                  maxLength={200}
                />
                <Input
                  name="description"
                  defaultValue={quiz.description ?? ""}
                  maxLength={4000}
                />
                <div className="flex gap-3">
                  <Input
                    name="type"
                    defaultValue={quiz.type}
                    required
                    minLength={2}
                    maxLength={32}
                  />
                  <Input
                    name="time_limit_seconds"
                    type="number"
                    min={1}
                    max={86400}
                    defaultValue={quiz.time_limit_seconds ?? ""}
                    placeholder="Detik (kosong = bebas)"
                  />
                </div>
                <div className="flex gap-3">
                  <Input
                    name="max_attempts"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={quiz.max_attempts}
                    required
                  />
                  <Input
                    name="passing_score"
                    type="number"
                    min={0}
                    step="any"
                    defaultValue={quiz.passing_score ?? ""}
                    placeholder="Nilai lulus"
                  />
                </div>
                <div className="flex gap-3">
                  <Input
                    name="available_from"
                    type="datetime-local"
                    defaultValue={toLocalInput(quiz.available_from)}
                  />
                  <Input
                    name="due_at"
                    type="datetime-local"
                    defaultValue={toLocalInput(quiz.due_at)}
                  />
                </div>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="shuffle_questions"
                      defaultChecked={quiz.shuffle_questions}
                    />
                    Acak soal
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="shuffle_options"
                      defaultChecked={quiz.shuffle_options}
                    />
                    Acak opsi
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_graded"
                      defaultChecked={quiz.is_graded}
                    />
                    Nilai otomatis
                  </label>
                </div>
                <select
                  name="status"
                  defaultValue={quiz.status}
                  className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
                <Button type="submit">Simpan</Button>
              </form>
            ) : null}
            <div className="flex gap-3">
              {canPublish && quiz.status === "DRAFT" ? (
                <form action={publishQuiz}>
                  <input type="hidden" name="quiz_id" value={quiz.id} />
                  <Button type="submit" size="sm">
                    Publish
                  </Button>
                </form>
              ) : null}
              {canDelete ? (
                <form action={deleteQuiz}>
                  <input type="hidden" name="quiz_id" value={quiz.id} />
                  <Button type="submit" size="sm" variant="destructive">
                    Hapus
                  </Button>
                </form>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
