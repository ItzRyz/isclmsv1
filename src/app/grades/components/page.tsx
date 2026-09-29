import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  createComponent,
  deleteComponent,
  setWeight,
} from "@/features/grades/actions";

export default async function GradeComponentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const periodId = (() => {
    const v = sp["period"];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  })();

  const supabase = await createClient();
  const { data: components } = await supabase
    .from("grade_components")
    .select("id, code, name, max_score, default_weight")
    .order("code");
  const { data: periods } = await supabase
    .from("academic_periods")
    .select("id, name")
    .order("name");
  const { data: weights } = periodId
    ? await supabase
        .from("grade_weights")
        .select("grade_component_id, course_id, division_id, weight")
        .eq("academic_period_id", periodId)
    : { data: [] as unknown[] };
  const manageable = await can("grade.update").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Komponen nilai & bobot</h1>

      <Card>
        <CardHeader>
          <CardTitle>Komponen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {(
            (components ?? []) as {
              id: string;
              code: string;
              name: string;
              max_score: number;
              default_weight: number;
            }[]
          ).map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-1">
              <span className="flex-1 font-medium">
                {c.name} <Badge variant="outline">{c.code}</Badge>
              </span>
              <Badge variant="secondary">maks {c.max_score}</Badge>
              <Badge variant="outline">bobot {c.default_weight}</Badge>
              {manageable ? (
                <form action={deleteComponent}>
                  <input type="hidden" name="component_id" value={c.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Hapus
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
          {manageable ? (
            <form
              action={createComponent}
              className="mt-2 flex gap-2 border-t pt-3"
            >
              <Input
                name="code"
                placeholder="KODE"
                required
                minLength={2}
                maxLength={32}
              />
              <Input
                name="name"
                placeholder="Nama"
                required
                minLength={2}
                maxLength={120}
              />
              <Input
                name="max_score"
                type="number"
                min={1}
                placeholder="Maks"
                required
              />
              <Input
                name="default_weight"
                type="number"
                min={0}
                placeholder="Bobot"
                required
              />
              <Button type="submit" size="sm">
                Tambah
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bobot per periode</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <form method="GET" className="flex gap-2">
            <select
              name="period"
              defaultValue={periodId}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Pilih periode…</option>
              {((periods ?? []) as { id: string; name: string }[]).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="outline">
              Tampilkan
            </Button>
          </form>
          {periodId
            ? ((components ?? []) as { id: string; code: string }[]).map(
                (c) => {
                  const w = (
                    (weights ?? []) as {
                      grade_component_id: string;
                      course_id: string | null;
                      division_id: string | null;
                      weight: number;
                    }[]
                  ).find((x) => x.grade_component_id === c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="flex-1">{c.code}</span>
                      <span className="text-muted-foreground">
                        {w
                          ? `bobot ${w.weight}${w.course_id || w.division_id ? " (spesifik)" : ""}`
                          : "bobot default"}
                      </span>
                      {manageable ? (
                        <form action={setWeight} className="flex gap-2">
                          <input
                            type="hidden"
                            name="academic_period_id"
                            value={periodId}
                          />
                          <input
                            type="hidden"
                            name="grade_component_id"
                            value={c.id}
                          />
                          <Input
                            name="weight"
                            type="number"
                            min={0}
                            step="any"
                            placeholder="Baru"
                            className="w-24"
                            required
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Set
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  );
                },
              )
            : null}
        </CardContent>
      </Card>
    </main>
  );
}
