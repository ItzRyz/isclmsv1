import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { markAllRead, markRead } from "@/features/notifications/actions";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Notifikasi</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Masuk dulu untuk melihat notifikasi.
          </CardContent>
        </Card>
      </main>
    );
  }

  const { data: items } = await supabase
    .from("notifications")
    .select(
      "id, type, title, body, entity_type, entity_id, read_at, created_at",
    )
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const unread = ((items ?? []) as { read_at: string | null }[]).filter(
    (n) => !n.read_at,
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Notifikasi {unread > 0 ? <Badge>{unread} baru</Badge> : null}
        </h1>
        {unread > 0 ? (
          <form action={markAllRead}>
            <Button type="submit" size="sm" variant="outline">
              Tandai semua dibaca
            </Button>
          </form>
        ) : null}
      </div>
      <div className="grid gap-3">
        {(
          (items ?? []) as {
            id: string;
            type: string;
            title: string;
            body: string | null;
            read_at: string | null;
            created_at: string;
          }[]
        ).map((n) => (
          <Card key={n.id} className={n.read_at ? "opacity-70" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {n.read_at ? null : <Badge>Baru</Badge>}
                {n.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              {n.body ? (
                <span className="text-muted-foreground">{n.body}</span>
              ) : null}
              <div className="flex items-center gap-2">
                <Badge variant="outline">{n.type}</Badge>
                <span className="text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("id-ID")}
                </span>
                {!n.read_at ? (
                  <form action={markRead} className="ml-auto">
                    <input type="hidden" name="notification_id" value={n.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Tandai dibaca
                    </Button>
                  </form>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
        {(items ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada notifikasi.{" "}
              <Link href="/learning" className="underline">
                Belajar dulu?
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
