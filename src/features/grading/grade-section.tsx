import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { gradeSubmission } from "./actions";

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
          </div>
        ))}
        {((subs ?? []) as unknown[]).length === 0 ? (
          <span className="text-muted-foreground">Belum ada submission.</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
