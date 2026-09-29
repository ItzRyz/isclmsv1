import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { enterGrade } from "@/features/grades/entry-actions";

const SOURCES = [
  "MANUAL",
  "ASSIGNMENT",
  "QUIZ",
  "ATTENDANCE",
  "PRACTICE",
  "COMPETITION",
];

export default async function GradeEntryPage() {
  const allowed = await can("grade.create").catch(() => false);
  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Butuh permission grade.create.
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
  const { data: components } = await supabase
    .from("grade_components")
    .select("id, code, name, max_score")
    .order("code");
  const { data: recent } = await supabase
    .from("grades")
    .select(
      "id, raw_score, normalized_score, weight_applied, weighted_score, created_at, grade_components(code), profiles!grades_user_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Entri nilai</h1>

      <Card>
        <CardHeader>
          <CardTitle>Nilai baru (normalisasi + bobot otomatis)</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={enterGrade} className="flex flex-col gap-3">
            <Input name="user_id" placeholder="User ID (UUID)" required />
            <div className="flex gap-3">
              <select
                name="academic_period_id"
                required
                defaultValue=""
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Periode
                </option>
                {((periods ?? []) as { id: string; name: string }[]).map(
                  (p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ),
                )}
              </select>
              <select
                name="grade_component_id"
                required
                defaultValue=""
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Komponen
                </option>
                {(
                  (components ?? []) as {
                    id: string;
                    code: string;
                    name: string;
                  }[]
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <select
                name="course_id"
                defaultValue=""
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Tanpa course</option>
                {((courses ?? []) as { id: string; name: string }[]).map(
                  (c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ),
                )}
              </select>
              <select
                name="source_type"
                defaultValue="MANUAL"
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <Input
                name="raw_score"
                type="number"
                min={0}
                step="any"
                placeholder="Skor mentah"
                required
              />
              <Input name="source_id" placeholder="Source ID (opsional)" />
            </div>
            <Button type="submit">Simpan nilai</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terbaru (20)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {(
            (recent ?? []) as unknown as {
              id: string;
              raw_score: number;
              normalized_score: number;
              weight_applied: number;
              weighted_score: number;
              created_at: string;
              grade_components: { code: string } | { code: string }[] | null;
              profiles:
                | { full_name: string | null }
                | { full_name: string | null }[]
                | null;
            }[]
          ).map((g) => {
            const compRaw = g.grade_components;
            const comp = Array.isArray(compRaw) ? compRaw[0] : compRaw;
            const profRaw = g.profiles;
            const prof = Array.isArray(profRaw) ? profRaw[0] : profRaw;
            return (
              <div
                key={g.id}
                className="flex flex-wrap items-center gap-2 border-b py-1 last:border-0"
              >
                <span className="flex-1">{prof?.full_name ?? "—"}</span>
                <Badge variant="outline">{comp?.code}</Badge>
                <span>
                  {g.raw_score} → {g.normalized_score} × {g.weight_applied} ={" "}
                  {g.weighted_score}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </main>
  );
}
