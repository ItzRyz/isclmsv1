import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createQuestion, deleteQuestion } from "@/features/questions/actions";

export default async function QuestionBankPage() {
  const manageable = await can("quiz.create").catch(() => false);
  if (!manageable) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Butuh permission quiz.create.
          </CardContent>
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_type, prompt, difficulty")
    .order("created_at", { ascending: false })
    .limit(100);
  const qIds = ((questions ?? []) as { id: string }[]).map((q) => q.id);
  const { data: options } = qIds.length
    ? await supabase
        .from("question_options")
        .select("question_id, option_text, is_correct, position")
        .in("question_id", qIds)
        .order("position")
    : { data: [] as unknown[] };
  const byQ = new Map<string, { option_text: string; is_correct: boolean }[]>();
  for (const o of (options ?? []) as {
    question_id: string;
    option_text: string;
    is_correct: boolean;
  }[]) {
    byQ.set(o.question_id, [
      ...(byQ.get(o.question_id) ?? []),
      { option_text: o.option_text, is_correct: o.is_correct },
    ]);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">
        Bank soal ({((questions ?? []) as unknown[]).length})
      </h1>

      <div className="grid gap-3">
        {(
          (questions ?? []) as {
            id: string;
            question_type: string;
            prompt: string;
            difficulty: string | null;
          }[]
        ).map((q) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <Badge variant="outline">{q.question_type}</Badge>
                {q.difficulty ? (
                  <Badge variant="secondary">{q.difficulty}</Badge>
                ) : null}
                <form action={deleteQuestion} className="ml-auto">
                  <input type="hidden" name="question_id" value={q.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Hapus
                  </Button>
                </form>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <p className="font-medium">{q.prompt}</p>
              {(byQ.get(q.id) ?? []).map((o, i) => (
                <span
                  key={i}
                  className={
                    o.is_correct
                      ? "text-primary font-semibold"
                      : "text-muted-foreground"
                  }
                >
                  {i + 1}. {o.option_text} {o.is_correct ? "✓" : ""}
                </span>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Soal baru</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createQuestion} className="flex flex-col gap-3">
            <div className="flex gap-3">
              <select
                name="question_type"
                defaultValue="SINGLE_CHOICE"
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                <option value="SINGLE_CHOICE">Pilihan tunggal</option>
                <option value="MULTIPLE_CHOICE">Pilihan ganda</option>
                <option value="TRUE_FALSE">Benar/Salah (isi 2 opsi)</option>
              </select>
              <Input
                name="difficulty"
                placeholder="Kesulitan (opsional)"
                maxLength={32}
              />
            </div>
            <textarea
              name="prompt"
              rows={3}
              required
              minLength={3}
              maxLength={8000}
              placeholder="Tulis soal…"
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  name={`opt_${i}`}
                  placeholder={`Opsi ${i + 1}${i < 2 ? " (wajib)" : " (opsional)"}`}
                  maxLength={2000}
                />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" name={`correct_${i}`} />
                  Benar
                </label>
              </div>
            ))}
            <Input
              name="explanation"
              placeholder="Pembahasan (opsional)"
              maxLength={8000}
            />
            <Button type="submit">Simpan soal</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
