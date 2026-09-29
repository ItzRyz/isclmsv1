import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { ExportCsv, type ReportRow } from "@/features/attendance/export-csv";

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string): string => {
    const v = sp[k];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  };
  const from = get("from");
  const to = get("to");
  const status = get("status");

  const allowed = await can("attendance.view").catch(() => false);
  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Butuh permission attendance.view.
          </CardContent>
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  let query = supabase
    .from("attendance_records")
    .select(
      "status, method, checked_in_at, distance_meters, profiles(full_name), attendance_sessions(name, starts_at)",
    )
    .order("checked_in_at", { ascending: false })
    .limit(1000);
  if (status) query = query.eq("status", status);

  const { data } = await query;
  const rows: (ReportRow & { ts: number })[] = (
    (data ?? []) as unknown as {
      status: string;
      method: string;
      checked_in_at: string;
      distance_meters: number | null;
      profiles:
        { full_name: string | null } | { full_name: string | null }[] | null;
      attendance_sessions:
        | { name: string; starts_at: string }
        | { name: string; starts_at: string }[]
        | null;
    }[]
  ).map((r) => {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const sess = Array.isArray(r.attendance_sessions)
      ? r.attendance_sessions[0]
      : r.attendance_sessions;
    return {
      session: sess?.name ?? "—",
      starts_at: sess?.starts_at ?? "",
      member: prof?.full_name ?? "—",
      status: r.status,
      method: r.method,
      checked_in_at: r.checked_in_at,
      distance: r.distance_meters,
      ts: sess ? new Date(sess.starts_at).getTime() : 0,
    };
  });

  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toMs = to ? new Date(`${to}T23:59:59`).getTime() : null;
  const filtered = rows.filter(
    (r) =>
      (fromMs === null || r.ts >= fromMs) && (toMs === null || r.ts <= toMs),
  );
  const counts = new Map<string, number>();
  for (const r of filtered)
    counts.set(r.status, (counts.get(r.status) ?? 0) + 1);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Laporan absensi</h1>
        <ExportCsv rows={filtered} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap gap-3">
            <Input name="from" type="date" defaultValue={from} />
            <Input name="to" type="date" defaultValue={to} />
            <select
              name="status"
              defaultValue={status}
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Semua status</option>
              <option value="PRESENT">PRESENT</option>
              <option value="LATE">LATE</option>
              <option value="PERMITTED">PERMITTED</option>
              <option value="SICK">SICK</option>
              <option value="ABSENT">ABSENT</option>
            </select>
            <Button type="submit" size="sm">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {[...counts.entries()].map(([s, n]) => (
          <Badge key={s} variant="outline">
            {s}: {n}
          </Badge>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1 pt-6 text-sm">
          {filtered.slice(0, 200).map((r, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 border-b py-1 last:border-0"
            >
              <span className="flex-1 font-medium">{r.member}</span>
              <span className="text-muted-foreground">{r.session}</span>
              <Badge>{r.status}</Badge>
              <Badge variant="outline">{r.method}</Badge>
              <span className="text-muted-foreground">
                {new Date(r.checked_in_at).toLocaleString("id-ID")}
              </span>
            </div>
          ))}
          {filtered.length === 0 ? (
            <span className="text-muted-foreground">Tidak ada data.</span>
          ) : null}
          {filtered.length > 200 ? (
            <span className="text-muted-foreground">
              Menampilkan 200 dari {filtered.length} (export CSV mencakup
              semua).
            </span>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
