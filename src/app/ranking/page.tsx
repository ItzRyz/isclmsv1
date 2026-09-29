import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function LeaderboardPage({
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
  const divisionId = get("division");

  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("ranking_periods")
    .select("id, name, metric, status")
    .order("created_at", { ascending: false });
  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .order("name");

  const activePeriodId =
    periodId || ((periods ?? []) as { id: string }[])[0]?.id || "";
  const { data: entries } = activePeriodId
    ? await supabase
        .from("ranking_entries")
        .select("user_id, rank, score, points, profiles(full_name)")
        .eq("ranking_period_id", activePeriodId)
        .order("rank")
        .limit(100)
    : { data: [] as unknown[] };

  let divisionMembers: Set<string> | null = null;
  if (divisionId) {
    const { data: members } = await supabase
      .from("user_divisions")
      .select("user_id")
      .eq("division_id", divisionId)
      .is("ended_at", null);
    divisionMembers = new Set(
      ((members ?? []) as { user_id: string }[]).map((m) => m.user_id),
    );
  }
  const rows = (
    (entries ?? []) as {
      user_id: string;
      rank: number;
      score: number;
      points: number;
      profiles: { full_name: string | null } | null;
    }[]
  )
    .map((e) => ({
      ...e,
      name:
        (Array.isArray(e.profiles) ? e.profiles[0] : e.profiles)?.full_name ??
        "—",
    }))
    .filter((e) => !divisionMembers || divisionMembers.has(e.user_id));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Papan peringkat</h1>
        <Link href="/ranking/periods">
          <Button size="sm" variant="outline">
            Kelola periode
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex gap-2">
            <select
              name="period"
              defaultValue={activePeriodId}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              {(
                (periods ?? []) as {
                  id: string;
                  name: string;
                  metric: string;
                }[]
              ).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.metric})
                </option>
              ))}
            </select>
            <select
              name="division"
              defaultValue={divisionId}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Semua divisi</option>
              {((divisions ?? []) as { id: string; name: string }[]).map(
                (d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ),
              )}
            </select>
            <Button type="submit" size="sm">
              Tampilkan
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabel ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {rows.map((r) => (
            <div
              key={r.user_id}
              className="flex items-center gap-2 border-b py-1 last:border-0"
            >
              <Badge className="w-10 justify-center">#{r.rank}</Badge>
              <span className="flex-1 font-medium">{r.name}</span>
              <span>Skor {r.score}</span>
              <Badge variant="outline">{r.points} poin</Badge>
            </div>
          ))}
          {rows.length === 0 ? (
            <span className="text-muted-foreground">
              Belum ada entri. Hitung ulang dari halaman periode.
            </span>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
