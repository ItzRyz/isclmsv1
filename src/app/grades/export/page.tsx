import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { ExportGradesButtons } from "@/features/grades/export-buttons";

export default async function GradesExportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string): string => {
    const v = sp[k];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  };
  const periodId = get("period");
  const courseId = get("course");

  const allowed = await can("report.export").catch(() => false);
  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Butuh permission report.export.
          </CardContent>
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("academic_periods")
    .select("id, name")
    .order("name");
  const { data: courses } = await supabase
    .from("courses")
    .select("id, name")
    .order("name")
    .limit(100);

  let query = supabase
    .from("grades")
    .select(
      "raw_score, normalized_score, weight_applied, weighted_score, source_type, created_at, profiles(full_name), grade_components(code)",
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  if (periodId) query = query.eq("academic_period_id", periodId);
  if (courseId) query = query.eq("course_id", courseId);
  const { data } = await query;

  const rows = (
    (data ?? []) as unknown as {
      raw_score: number;
      normalized_score: number;
      weight_applied: number;
      weighted_score: number;
      source_type: string;
      created_at: string;
      profiles: { full_name: string | null } | null;
      grade_components: { code: string } | null;
    }[]
  ).map((g) => {
    const prof = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles;
    const comp = Array.isArray(g.grade_components)
      ? g.grade_components[0]
      : g.grade_components;
    return {
      student: prof?.full_name ?? "—",
      component: comp?.code ?? "—",
      source: g.source_type,
      raw: Number(g.raw_score),
      normalized: Number(g.normalized_score),
      weight: Number(g.weight_applied),
      weighted: Number(g.weighted_score),
      created_at: new Date(g.created_at).toLocaleString("id-ID"),
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Export nilai ({rows.length})</h1>
        <ExportGradesButtons rows={rows} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex gap-2">
            <select
              name="period"
              defaultValue={periodId}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Semua periode</option>
              {((periods ?? []) as { id: string; name: string }[]).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              name="course"
              defaultValue={courseId}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Semua course</option>
              {((courses ?? []) as { id: string; name: string }[]).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1 pt-6 text-sm">
          {rows.slice(0, 100).map((r, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 border-b py-1 last:border-0"
            >
              <span className="flex-1">{r.student}</span>
              <Badge variant="outline">{r.component}</Badge>
              <span>
                {r.raw} → {r.normalized} × {r.weight} = {r.weighted}
              </span>
            </div>
          ))}
          {rows.length === 0 ? (
            <span className="text-muted-foreground">Tidak ada data.</span>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
