import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createSession } from "@/features/attendance/actions";

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("attendance_sessions")
    .select("id, name, status, starts_at, ends_at, class_id, division_id")
    .order("starts_at", { ascending: false })
    .limit(50);
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("status", "ACTIVE")
    .order("name");
  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .order("name");
  const manageable = await can("attendance.open_session").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Absensi</h1>
        <Link href="/attendance/report">
          <Button size="sm" variant="outline">
            Laporan
          </Button>
        </Link>
      </div>

      <div className="grid gap-3">
        {(
          (sessions ?? []) as {
            id: string;
            name: string;
            status: string;
            starts_at: string;
          }[]
        ).map((s) => (
          <Link key={s.id} href={`/attendance/${s.id}`}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {s.name}
                  <Badge
                    variant={s.status === "OPEN" ? "default" : "secondary"}
                  >
                    {s.status}
                  </Badge>
                  <span className="text-muted-foreground text-xs font-normal">
                    {new Date(s.starts_at).toLocaleString("id-ID")}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
        {(sessions ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada sesi.
            </CardContent>
          </Card>
        ) : null}
      </div>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Buka sesi baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createSession} className="flex flex-col gap-3">
              <Input
                name="name"
                placeholder="Nama sesi"
                required
                minLength={3}
                maxLength={160}
              />
              <select
                name="scope"
                required
                defaultValue=""
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Pilih kelas/divisi
                </option>
                {((classes ?? []) as { id: string; name: string }[]).map(
                  (c) => (
                    <option key={`c:${c.id}`} value={`class:${c.id}`}>
                      Kelas: {c.name}
                    </option>
                  ),
                )}
                {((divisions ?? []) as { id: string; name: string }[]).map(
                  (d) => (
                    <option key={`d:${d.id}`} value={`division:${d.id}`}>
                      Divisi: {d.name}
                    </option>
                  ),
                )}
              </select>
              <div className="flex gap-3">
                <Input name="starts_at" type="datetime-local" required />
                <Input name="ends_at" type="datetime-local" required />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="geofence_enabled" />
                Aktifkan geofence
              </label>
              <div className="flex gap-3">
                <Input
                  name="latitude"
                  type="number"
                  step="any"
                  placeholder="Latitude"
                />
                <Input
                  name="longitude"
                  type="number"
                  step="any"
                  placeholder="Longitude"
                />
                <Input
                  name="radius_meters"
                  type="number"
                  min={1}
                  placeholder="Radius (m)"
                />
              </div>
              <Button type="submit">Buka sesi</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
