import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { gradeSubmission } from "./actions";
import { requestRevision, resubmit } from "@/features/revisions/actions";

type SubmissionRow = {
  id: string;
  user_id: string | null;
  assignment_group_id: string | null;
  status: string;
  score: number | null;
  version: number;
  submitted_at: string | null;
};

/** Penilaian staf + riwayat feedback pemilik. */
export async function GradeSection({
  assignmentId,
  canGrade,
}: {
  assignmentId: string;
  canGrade: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subs } = canGrade
    ? await supabase
        .from("submissions")
        .select(
          "id, user_id, assignment_group_id, status, score, version, submitted_at",
        )
        .eq("assignment_id", assignmentId)
        .order("submitted_at", { ascending: false })
    : user
      ? await supabase
          .from("submissions")
          .select(
            "id, user_id, assignment_group_id, status, score, version, submitted_at",
          )
          .eq("assignment_id", assignmentId)
          .eq("user_id", user.id)
      : { data: [] as SubmissionRow[] };

  const { data: rubrics } = await supabase
    .from("rubrics")
    .select("id, name")
    .eq("assignment_id", assignmentId);
  const rubricIds = ((rubrics ?? []) as { id: string }[]).map((r) => r.id);
  const { data: items } = rubricIds.length
    ? await supabase
        .from("rubric_items")
        .select("id, rubric_id, criterion, max_points")
        .in("rubric_id", rubricIds)
        .order("position")
    : { data: [] as unknown[] };

  const subIds = ((subs ?? []) as SubmissionRow[]).map((s) => s.id);
  const { data: feedbacks } = subIds.length
    ? await supabase
        .from("submission_feedback")
        .select("submission_id, body, created_at")
        .in("submission_id", subIds)
        .order("created_at", { ascending: false })
    : { data: [] as unknown[] };
  const fbBySub = new Map<string, { body: string; created_at: string }[]>();
  for (const f of (feedbacks ?? []) as {
    submission_id: string;
    body: string;
    created_at: string;
  }[]) {
    fbBySub.set(f.submission_id, [...(fbBySub.get(f.submission_id) ?? []), f]);
  }

  const { data: revisions } = subIds.length
    ? await supabase
        .from("submission_revisions")
        .select("submission_id, version, submitted_at, score, status")
        .in("submission_id", subIds)
        .order("version")
    : { data: [] as unknown[] };
  const revBySub = new Map<
    string,
    {
      version: number;
      submitted_at: string;
      score: number | null;
      status: string;
    }[]
  >();
  for (const r of (revisions ?? []) as {
    submission_id: string;
    version: number;
    submitted_at: string;
    score: number | null;
    status: string;
  }[]) {
    revBySub.set(r.submission_id, [
      ...(revBySub.get(r.submission_id) ?? []),
      r,
    ]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Penilaian & umpan balik ({((subs ?? []) as unknown[]).length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {((subs ?? []) as SubmissionRow[]).map((s) => (
          <div key={s.id} className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{s.status}</Badge>
              <span className="text-muted-foreground">v{s.version}</span>
              {s.score != null ? (
                <Badge variant="secondary">Nilai {s.score}</Badge>
              ) : null}
              <span className="text-muted-foreground ml-auto">
                {s.submitted_at
                  ? new Date(s.submitted_at).toLocaleString("id-ID")
                  : "draf"}
              </span>
            </div>
            {(fbBySub.get(s.id) ?? []).map((f, i) => (
              <p
                key={i}
                className="bg-muted rounded-md p-2 text-sm whitespace-pre-wrap"
              >
                {f.body}
              </p>
            ))}
            {canGrade &&
            (s.status === "SUBMITTED" ||
              s.status === "LATE" ||
              s.status === "RESUBMITTED") ? (
              <form
                action={gradeSubmission}
                className="flex flex-col gap-2 border-t pt-2"
              >
                <input type="hidden" name="submission_id" value={s.id} />
                {(
                  (items ?? []) as {
                    id: string;
                    rubric_id: string;
                    criterion: string;
                    max_points: number;
                  }[]
                ).map((it) => (
                  <div key={it.id} className="flex items-center gap-2">
                    <span className="flex-1">{it.criterion}</span>
                    <Input
                      name={`pts_${it.id}`}
                      type="number"
                      min={0}
                      max={it.max_points}
                      step="any"
                      placeholder={`0–${it.max_points}`}
                      className="w-28"
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    name="score"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Skor total"
                    required
                  />
                </div>
                <textarea
                  name="feedback"
                  rows={2}
                  maxLength={8000}
                  placeholder="Umpan balik untuk peserta…"
                  className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm">
                  Simpan nilai
                </Button>
              </form>
            ) : null}
            {(revBySub.get(s.id) ?? []).length > 0 ? (
              <div className="text-muted-foreground flex flex-col gap-1 border-t pt-2 text-xs">
                <span className="font-medium">Riwayat revisi:</span>
                {(revBySub.get(s.id) ?? []).map((r, i) => (
                  <span key={i}>
                    v{r.version} · {r.status} ·{" "}
                    {new Date(r.submitted_at).toLocaleString("id-ID")}
                    {r.score != null ? ` · nilai ${r.score}` : ""}
                  </span>
                ))}
              </div>
            ) : null}
            {canGrade &&
            (s.status === "SUBMITTED" ||
              s.status === "LATE" ||
              s.status === "RESUBMITTED") ? (
              <form
                action={requestRevision}
                className="flex gap-2 border-t pt-2"
              >
                <input type="hidden" name="submission_id" value={s.id} />
                <Input
                  name="feedback"
                  placeholder="Alasan revisi…"
                  required
                  minLength={1}
                  maxLength={8000}
                />
                <Button type="submit" size="sm" variant="outline">
                  Minta revisi
                </Button>
              </form>
            ) : null}
            {!canGrade && s.status === "REVISION_REQUIRED" ? (
              <form
                action={resubmit}
                className="flex flex-col gap-2 border-t pt-2"
              >
                <input type="hidden" name="submission_id" value={s.id} />
                <textarea
                  name="text_content"
                  rows={3}
                  maxLength={50000}
                  placeholder="Perbaiki jawaban…"
                  className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm">
                  Submit ulang
                </Button>
              </form>
            ) : null}
          </div>
        ))}
        {((subs ?? []) as unknown[]).length === 0 ? (
          <span className="text-muted-foreground">Belum ada submission.</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
