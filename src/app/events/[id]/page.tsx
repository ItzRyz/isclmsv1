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
  deleteEvent,
  markEventAttendance,
  registerEvent,
  updateEvent,
} from "@/features/events/actions";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, name, slug, description, type, starts_at, ends_at, location, capacity, status",
    )
    .eq("id", id)
    .single();
  if (!event) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: participants } = await supabase
    .from("event_participants")
    .select("user_id, status, profiles(full_name)")
    .eq("event_id", id)
    .order("registered_at");
  const { data: attendance } = await supabase
    .from("event_attendance")
    .select("user_id")
    .eq("event_id", id);
  const presentSet = new Set(
    ((attendance ?? []) as { user_id: string }[]).map((a) => a.user_id),
  );
  const mine = ((participants ?? []) as { user_id: string }[]).some(
    (p) => p.user_id === user?.id,
  );

  const canEdit = await can("event.update").catch(() => false);
  const canDelete = await can("event.delete").catch(() => false);
  const canMark = await can("attendance.correct").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {event.name}
            <Badge variant="outline">{event.type}</Badge>
            <Badge>{event.status}</Badge>
          </CardTitle>
          <CardDescription>
            {new Date(event.starts_at).toLocaleString("id-ID")} →{" "}
            {new Date(event.ends_at).toLocaleString("id-ID")}
            {event.location ? ` · ${event.location}` : ""}
            {typeof event.capacity === "number"
              ? ` · Kapasitas ${event.capacity}`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="whitespace-pre-wrap">
            {event.description ?? "Tanpa deskripsi."}
          </p>
          {user && !mine && event.status === "PUBLISHED" ? (
            <form action={registerEvent}>
              <input type="hidden" name="event_id" value={event.id} />
              <Button type="submit" size="sm">
                Daftar event ini
              </Button>
            </form>
          ) : null}
          {mine ? <Badge variant="secondary">Terdaftar ✓</Badge> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Peserta ({((participants ?? []) as unknown[]).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {(
            (participants ?? []) as unknown as {
              user_id: string;
              status: string;
              profiles:
                | { full_name: string | null }
                | { full_name: string | null }[]
                | null;
            }[]
          ).map((p) => {
            const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
            return (
              <div key={p.user_id} className="flex items-center gap-2 py-1">
                <span className="flex-1">{prof?.full_name ?? p.user_id}</span>
                {presentSet.has(p.user_id) ? (
                  <Badge variant="secondary">Hadir</Badge>
                ) : (
                  <Badge variant="outline">{p.status}</Badge>
                )}
                {canMark && !presentSet.has(p.user_id) ? (
                  <form action={markEventAttendance}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="user_id" value={p.user_id} />
                    <Button type="submit" size="sm" variant="outline">
                      Tandai hadir
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })}
          {(participants ?? []).length === 0 ? (
            <span className="text-muted-foreground">Belum ada peserta.</span>
          ) : null}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Ubah event</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateEvent} className="flex flex-col gap-3">
              <input type="hidden" name="event_id" value={event.id} />
              <Input
                name="name"
                defaultValue={event.name}
                required
                minLength={3}
                maxLength={160}
              />
              <div className="flex gap-3">
                <Input
                  name="slug"
                  defaultValue={event.slug}
                  required
                  minLength={2}
                  maxLength={80}
                />
                <Input
                  name="type"
                  defaultValue={event.type}
                  required
                  minLength={2}
                  maxLength={32}
                />
                <select
                  name="status"
                  defaultValue={event.status}
                  className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Input
                  name="starts_at"
                  type="datetime-local"
                  defaultValue={toLocalInput(event.starts_at)}
                  required
                />
                <Input
                  name="ends_at"
                  type="datetime-local"
                  defaultValue={toLocalInput(event.ends_at)}
                  required
                />
              </div>
              <Button type="submit">Simpan</Button>
            </form>
            {canDelete ? (
              <form action={deleteEvent} className="mt-3">
                <input type="hidden" name="event_id" value={event.id} />
                <Button type="submit" size="sm" variant="destructive">
                  Hapus event
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
