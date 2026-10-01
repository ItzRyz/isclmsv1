import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { startConversation } from "@/features/messages/actions";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Pesan</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Masuk dulu untuk berkirim pesan.
          </CardContent>
        </Card>
      </main>
    );
  }

  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", user.id);
  const cids = ((memberships ?? []) as { conversation_id: string }[]).map(
    (m) => m.conversation_id,
  );
  const { data: allMembers } = cids.length
    ? await supabase
        .from("conversation_members")
        .select("conversation_id, user_id, profiles(full_name)")
        .in("conversation_id", cids)
    : { data: [] as unknown[] };
  const { data: lastMessages } = cids.length
    ? await supabase
        .from("messages")
        .select("conversation_id, body, created_at, sender_id")
        .in("conversation_id", cids)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] as unknown[] };

  const lastByConvo = new Map<
    string,
    { body: string; created_at: string; sender_id: string }
  >();
  for (const m of (lastMessages ?? []) as {
    conversation_id: string;
    body: string;
    created_at: string;
    sender_id: string;
  }[]) {
    if (!lastByConvo.has(m.conversation_id))
      lastByConvo.set(m.conversation_id, m);
  }
  const readAt = new Map(
    (
      (memberships ?? []) as {
        conversation_id: string;
        last_read_at: string | null;
      }[]
    ).map((m) => [m.conversation_id, m.last_read_at]),
  );
  const namesByConvo = new Map<string, string>();
  for (const m of (allMembers ?? []) as {
    conversation_id: string;
    user_id: string;
    profiles: { full_name: string | null } | null;
  }[]) {
    if (m.user_id === user.id) continue;
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    namesByConvo.set(m.conversation_id, prof?.full_name ?? "—");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Pesan</h1>

      <div className="grid gap-3">
        {cids.map((cid) => {
          const last = lastByConvo.get(cid);
          const seen = readAt.get(cid);
          const unread =
            !!last && (!seen || new Date(last.created_at) > new Date(seen));
          return (
            <Link key={cid} href={`/messages/${cid}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {namesByConvo.get(cid) ?? "Percakapan"}
                    {unread ? <Badge>Baru</Badge> : null}
                  </CardTitle>
                </CardHeader>
                {last ? (
                  <CardContent className="text-muted-foreground truncate text-sm">
                    {last.body}
                  </CardContent>
                ) : null}
              </Card>
            </Link>
          );
        })}
        {cids.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada percakapan.
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mulai percakapan</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={startConversation} className="flex gap-2">
            <Input
              name="other_user_id"
              placeholder="User ID lawan bicara (UUID)"
              required
            />
            <Button type="submit" size="sm">
              Mulai
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
