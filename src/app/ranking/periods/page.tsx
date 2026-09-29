import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  computeRankingForm,
  createRankingPeriod,
  deleteRankingPeriod,
} from "@/features/ranking/actions";

export default async function RankingPeriodsPage() {
  const manageable = await can("ranking.manage").catch(() => false);
  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("ranking_periods")
    .select("id, name, type, metric, status, start_date, end_date")
    .order("created_at", { ascending: false });
  const { data: academic } = await supabase
    .from("academic_periods")
    .select("id, name")
    .order("name");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Periode ranking</h1>

      <div className="grid gap-3">
        {(
          (periods ?? []) as {
            id: string;
            name: string;
            type: string;
            metric: string;
            status: string;
          }[]
        ).map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {p.name}
                <Badge variant="outline">{p.type}</Badge>
                <Badge variant="secondary">{p.metric}</Badge>
                <Badge>{p.status}</Badge>
              </CardTitle>
            </CardHeader>
            {manageable ? (
              <CardContent className="flex gap-2">
                <form action={computeRankingForm}>
                  <input type="hidden" name="period_id" value={p.id} />
                  <Button type="submit" size="sm">
                    Hitung ulang
                  </Button>
                </form>
                <form action={deleteRankingPeriod}>
                  <input type="hidden" name="period_id" value={p.id} />
                  <Button type="submit" size="sm" variant="destructive">
                    Hapus
                  </Button>
                </form>
              </CardContent>
            ) : null}
          </Card>
        ))}
      </div>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Periode baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createRankingPeriod} className="flex flex-col gap-3">
              <Input
                name="name"
                placeholder="Nama periode"
                required
                minLength={3}
                maxLength={160}
              />
              <div className="flex gap-3">
                <select
                  name="type"
                  defaultValue="SEMESTER"
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="MONTHLY">MONTHLY</option>
                  <option value="SEMESTER">SEMESTER</option>
                </select>
                <select
                  name="metric"
                  defaultValue="POINTS"
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="POINTS">POINTS</option>
                  <option value="GRADES">GRADES</option>
                  <option value="MIXED">MIXED</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Input name="start_date" type="date" />
                <Input name="end_date" type="date" />
              </div>
              <select
                name="academic_period_id"
                defaultValue=""
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Tanpa periode akademik (metrik poin)</option>
                {((academic ?? []) as { id: string; name: string }[]).map(
                  (a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ),
                )}
              </select>
              <Button type="submit">Buat periode</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
