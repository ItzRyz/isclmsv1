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
  createAnnouncement,
  deleteAnnouncement,
} from "@/features/announcements/actions";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: all } = await supabase
    .from("announcements")
    .select(
      "id, title, body, priority, published_at, expires_at, division_id, class_id",
    )
    .lte("published_at", now)
    .order("published_at", { ascending: false })
    .limit(50);
  // Kedaluwarsa disaring di app (RLS menjaga scope, waktu dijaga di sini).
  const items = (
    (all ?? []) as {
      id: string;
      title: string;
      body: string;
      priority: string;
      published_at: string;
      expires_at: string | null;
    }[]
  ).filter((a) => !a.expires_at || a.expires_at > now);

  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .order("name");
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("status", "ACTIVE")
    .order("name")
    .limit(100);
  const manageable = await can("announcement.create").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Pengumuman</h1>

      <div className="grid gap-3">
        {items.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {a.title}
                <Badge
                  variant={
                    a.priority === "URGENT" ? "destructive" : "secondary"
                  }
                >
                  {a.priority}
                </Badge>
                {a.expires_at ? (
                  <Badge variant="outline">
                    s/d {new Date(a.expires_at).toLocaleString("id-ID")}
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                {new Date(a.published_at).toLocaleString("id-ID")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="whitespace-pre-wrap">{a.body}</p>
              {manageable ? (
                <form action={deleteAnnouncement}>
                  <input type="hidden" name="announcement_id" value={a.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Hapus
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {items.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada pengumuman aktif.
            </CardContent>
          </Card>
        ) : null}
      </div>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Pengumuman baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createAnnouncement} className="flex flex-col gap-3">
              <Input
                name="title"
                placeholder="Judul"
                required
                minLength={3}
                maxLength={200}
              />
              <textarea
                name="body"
                rows={3}
                required
                maxLength={10000}
                placeholder="Isi pengumuman…"
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              />
              <select
                name="scope"
                required
                defaultValue="organization"
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                <option value="organization">Organisasi (semua)</option>
                {((divisions ?? []) as { id: string; name: string }[]).map(
                  (d) => (
                    <option key={`d:${d.id}`} value={`division:${d.id}`}>
                      Divisi: {d.name}
                    </option>
                  ),
                )}
                {((classes ?? []) as { id: string; name: string }[]).map(
                  (c) => (
                    <option key={`c:${c.id}`} value={`class:${c.id}`}>
                      Kelas: {c.name}
                    </option>
                  ),
                )}
              </select>
              <div className="flex gap-3">
                <select
                  name="priority"
                  defaultValue="NORMAL"
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="LOW">LOW</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
                <Input
                  name="published_at"
                  type="datetime-local"
                  defaultValue={toLocalInput(new Date().toISOString())}
                />
                <Input name="expires_at" type="datetime-local" />
              </div>
              <Button type="submit">Terbitkan</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
