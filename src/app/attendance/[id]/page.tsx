import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  closeSession,
  correctRecord,
  manualEntry,
  renderSessionQr,
  reopenSession,
} from "@/features/attendance/actions";
import { QrScanner } from "@/features/attendance/qr-scanner";
import { RotatingQr } from "@/features/attendance/rotating-qr";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("attendance_sessions")
    .select(
      "id, name, status, starts_at, ends_at, geofence_enabled, latitude, longitude, radius_meters, class_id, division_id",
    )
    .eq("id", id)
    .single();
  if (!session) notFound();

  const staff = await can("attendance.open_session").catch(() => false);
  const canCorrect = await can("attendance.correct").catch(() => false);

  const { data: records } = await supabase
    .from("attendance_records")
    .select(
      "id, user_id, status, method, checked_in_at, distance_meters, profiles(full_name)",
    )
    .eq("attendance_session_id", id)
    .order("checked_in_at");
  const recordIds = ((records ?? []) as { id: string }[]).map((r) => r.id);
  const { data: corrections } = recordIds.length
    ? await supabase
        .from("attendance_corrections")
        .select(
          "attendance_record_id, old_status, new_status, reason, created_at",
        )
        .in("attendance_record_id", recordIds)
        .order("created_at", { ascending: false })
    : { data: [] as unknown[] };

  const qr =
    staff && session.status === "OPEN"
      ? await renderSessionQr(id).catch(() => null)
      : null;
  const counts = new Map<string, number>();
  for (const r of (records ?? []) as { status: string }[]) {
    counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {session.name}
            <Badge
              variant={session.status === "OPEN" ? "default" : "secondary"}
            >
              {session.status}
            </Badge>
          </CardTitle>
          <CardDescription>
            {new Date(session.starts_at).toLocaleString("id-ID")} →{" "}
            {new Date(session.ends_at).toLocaleString("id-ID")}
            {session.geofence_enabled
              ? ` · Geofence ${session.radius_meters} m`
              : " · Tanpa geofence"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          {[...counts.entries()].map(([s, n]) => (
            <Badge key={s} variant="outline">
              {s}: {n}
            </Badge>
          ))}
          {staff && session.status === "OPEN" ? (
            <form action={closeSession} className="ml-auto">
              <input type="hidden" name="session_id" value={session.id} />
              <Button type="submit" size="sm" variant="outline">
                Tutup sesi
              </Button>
            </form>
          ) : null}
          {staff && session.status === "CLOSED" ? (
            <form action={reopenSession} className="ml-auto">
              <input type="hidden" name="session_id" value={session.id} />
              <Button type="submit" size="sm" variant="outline">
                Buka lagi
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {session.status === "OPEN" ? (
        <Card>
          <CardHeader>
            <CardTitle>Check-in mandiri</CardTitle>
            <CardDescription>
              Pindai QR sesi (minta ke mentor), izinkan lokasi bila geofence
              aktif.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QrScanner mode="self" />
          </CardContent>
        </Card>
      ) : null}

      {staff && qr ? (
        <Card>
          <CardHeader>
            <CardTitle>QR sesi (rotasi 60 dtk)</CardTitle>
            <CardDescription>
              Tampilkan ke peserta. Token lama hangus tiap rotasi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RotatingQr sessionId={session.id} initial={qr.img} />
          </CardContent>
        </Card>
      ) : null}

      {staff ? (
        <Card>
          <CardHeader>
            <CardTitle>Scan kartu anggota</CardTitle>
            <CardDescription>
              Arahkan ke QR kartu anggota yang hadir fisik.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QrScanner mode="mentor" sessionId={session.id} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            Catatan ({((records ?? []) as unknown[]).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {(
            (records ?? []) as unknown as {
              id: string;
              user_id: string;
              status: string;
              method: string;
              checked_in_at: string;
              distance_meters: number | null;
              profiles:
                | { full_name: string | null }
                | { full_name: string | null }[]
                | null;
            }[]
          ).map((r) => {
            const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-2 py-1"
              >
                <span className="flex-1">{prof?.full_name ?? r.user_id}</span>
                <Badge>{r.status}</Badge>
                <Badge variant="outline">{r.method}</Badge>
                {typeof r.distance_meters === "number" ? (
                  <Badge variant="outline">
                    {Math.round(r.distance_meters)} m
                  </Badge>
                ) : null}
                <span className="text-muted-foreground">
                  {new Date(r.checked_in_at).toLocaleString("id-ID")}
                </span>
              </div>
            );
          })}
          {(records ?? []).length === 0 ? (
            <span className="text-muted-foreground">Belum ada catatan.</span>
          ) : null}
        </CardContent>
      </Card>

      {canCorrect ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Entri manual</CardTitle>
              <CardDescription>
                Izin/sakit/alpa/hadir susulan + alasan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={manualEntry} className="flex flex-col gap-3">
                <input type="hidden" name="session_id" value={session.id} />
                <Input name="user_id" placeholder="User ID (UUID)" required />
                <div className="flex gap-3">
                  <select
                    name="status"
                    defaultValue="PRESENT"
                    className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="LATE">LATE</option>
                    <option value="PERMITTED">PERMITTED</option>
                    <option value="SICK">SICK</option>
                    <option value="ABSENT">ABSENT</option>
                  </select>
                  <Input
                    name="reason"
                    placeholder="Alasan (opsional)"
                    maxLength={1000}
                  />
                </div>
                <Button type="submit" size="sm">
                  Catat manual
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Koreksi status</CardTitle>
              <CardDescription>
                Teraudit (sebelum → sesudah + alasan).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <form action={correctRecord} className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <select
                    name="record_id"
                    required
                    defaultValue=""
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="" disabled>
                      Pilih catatan
                    </option>
                    {(
                      (records ?? []) as {
                        id: string;
                        user_id: string;
                        status: string;
                      }[]
                    ).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.user_id.slice(0, 8)}… ({r.status})
                      </option>
                    ))}
                  </select>
                  <select
                    name="new_status"
                    required
                    defaultValue="PRESENT"
                    className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="LATE">LATE</option>
                    <option value="PERMITTED">PERMITTED</option>
                    <option value="SICK">SICK</option>
                    <option value="ABSENT">ABSENT</option>
                  </select>
                </div>
                <Input
                  name="reason"
                  placeholder="Alasan koreksi (wajib)"
                  required
                  minLength={3}
                  maxLength={1000}
                />
                <Button type="submit" size="sm">
                  Koreksi
                </Button>
              </form>
              {(
                (corrections ?? []) as {
                  attendance_record_id: string;
                  old_status: string;
                  new_status: string;
                  reason: string;
                  created_at: string;
                }[]
              ).map((c, i) => (
                <div key={i} className="text-muted-foreground text-sm">
                  {c.old_status} → {c.new_status} · {c.reason} ·{" "}
                  {new Date(c.created_at).toLocaleString("id-ID")}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
