import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { markConversationRead, sendMessage } from "@/features/messages/actions";
import { LiveMessages } from "@/features/messages/live-messages";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .single();
  if (!membership) notFound();
  await markConversationRead(id);

  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id, profiles(full_name)")
    .eq("conversation_id", id);
  const names: Record<string, string> = {};
  for (const m of (members ?? []) as unknown as {
    user_id: string;
    profiles:
      { full_name: string | null } | { full_name: string | null }[] | null;
  }[]) {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    names[m.user_id] = prof?.full_name ?? "—";
  }
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", id)
    .is("deleted_at", null)
    .order("created_at")
    .limit(200);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {Object.entries(names)
              .filter(([uid]) => uid !== user.id)
              .map(([, n]) => n)
              .join(", ") || "Percakapan"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <LiveMessages
            conversationId={id}
            initial={
              (messages ?? []) as {
                id: string;
                sender_id: string;
                body: string;
                created_at: string;
              }[]
            }
            me={user.id}
            names={names}
          />
          <form action={sendMessage} className="flex gap-2 border-t pt-3">
            <input type="hidden" name="conversation_id" value={id} />
            <Input
              name="body"
              placeholder="Tulis pesan…"
              required
              minLength={1}
              maxLength={5000}
            />
            <Button type="submit" size="sm">
              Kirim
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
