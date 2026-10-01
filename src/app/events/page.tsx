import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "@/features/events/actions";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, type, status, starts_at, location")
    .order("starts_at");
  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .order("name");
  const manageable = await can("event.create").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Event</h1>

      <div className="grid gap-3">
        {(
          (events ?? []) as {
            id: string;
            name: string;
            type: string;
            status: string;
            starts_at: string;
          }[]
        ).map((e) => (
          <Link key={e.id} href={`/events/${e.id}`}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {e.name}
                  <Badge variant="outline">{e.type}</Badge>
                  <Badge>{e.status}</Badge>
                  <span className="text-muted-foreground text-xs font-normal">
                    {new Date(e.starts_at).toLocaleString("id-ID")}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
        {(events ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada event.
            </CardContent>
          </Card>
        ) : null}
      </div>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Event baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createEvent} className="flex flex-col gap-3">
              <Input
                name="name"
                placeholder="Nama event"
                required
                minLength={3}
                maxLength={160}
              />
              <div className="flex gap-3">
                <Input
                  name="slug"
                  placeholder="slug-event"
                  required
                  minLength={2}
                  maxLength={80}
                />
                <Input
                  name="type"
                  placeholder="Tipe mis. WORKSHOP"
                  required
                  minLength={2}
                  maxLength={32}
                />
                <select
                  name="status"
                  defaultValue="DRAFT"
                  className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <select
                name="division_id"
                defaultValue=""
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
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
              <Input
                name="location"
                placeholder="Lokasi (opsional)"
                maxLength={300}
              />
              <div className="flex gap-3">
                <Input name="starts_at" type="datetime-local" required />
                <Input name="ends_at" type="datetime-local" required />
                <Input
                  name="capacity"
                  type="number"
                  min={1}
                  placeholder="Kapasitas"
                />
              </div>
              <Input
                name="description"
                placeholder="Deskripsi"
                maxLength={4000}
              />
              <Button type="submit">Buat event</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
