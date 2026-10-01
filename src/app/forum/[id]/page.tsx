import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteThread,
  editPost,
  lockThread,
  replyThread,
  softDeletePost,
} from "@/features/forum/actions";
import { acceptAnswer } from "@/features/forum/qa-actions";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("forum_threads")
    .select(
      "id, title, locked_at, created_by, accepted_post_id, forum_categories(name)",
    )
    .eq("id", id)
    .single();
  if (!thread) notFound();

  const { data: posts } = await supabase
    .from("forum_posts")
    .select("id, author_id, body, created_at, profiles(full_name)")
    .eq("thread_id", id)
    .is("deleted_at", null)
    .order("created_at");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const moderate = await can("forum.moderate").catch(() => false);
  const locked = !!(thread as { locked_at: string | null }).locked_at;
  const writable = !!user && (!locked || moderate);
  const asker =
    user?.id === (thread as { created_by: string | null }).created_by;
  const acceptedId = (thread as { accepted_post_id: string | null })
    .accepted_post_id;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {(thread as { title: string }).title}
            {acceptedId ? <Badge variant="secondary">Terjawab ✓</Badge> : null}
            {locked ? <Badge variant="destructive">Terkunci</Badge> : null}
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-3">
        {(
          (posts ?? []) as unknown as {
            id: string;
            author_id: string;
            body: string;
            created_at: string;
            profiles:
              | { full_name: string | null }
              | { full_name: string | null }[]
              | null;
          }[]
        ).map((p) => {
          const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
          const mine = user?.id === p.author_id;
          return (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-1 pt-4 text-sm">
                <div className="text-muted-foreground flex items-center gap-2">
                  <span className="text-foreground font-medium">
                    {prof?.full_name ?? "—"}
                  </span>
                  <span>{new Date(p.created_at).toLocaleString("id-ID")}</span>
                  {(mine || moderate) && (
                    <form action={softDeletePost} className="ml-auto">
                      <input type="hidden" name="post_id" value={p.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Hapus
                      </Button>
                    </form>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{p.body}</p>
                <div className="flex items-center gap-2">
                  {acceptedId === p.id ? (
                    <Badge variant="secondary">Jawaban diterima ✓</Badge>
                  ) : (asker || moderate) && user ? (
                    <form action={acceptAnswer}>
                      <input type="hidden" name="thread_id" value={id} />
                      <input type="hidden" name="post_id" value={p.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Tandai jawaban
                      </Button>
                    </form>
                  ) : null}
                </div>
                {mine ? (
                  <form action={editPost} className="flex gap-2">
                    <input type="hidden" name="post_id" value={p.id} />
                    <input
                      name="body"
                      defaultValue={p.body}
                      required
                      minLength={1}
                      maxLength={10000}
                      className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                    />
                    <Button type="submit" size="sm" variant="outline">
                      Ubah
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {writable ? (
        <Card>
          <CardHeader>
            <CardTitle>Balas</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={replyThread} className="flex flex-col gap-3">
              <input type="hidden" name="thread_id" value={id} />
              <textarea
                name="body"
                rows={3}
                required
                minLength={1}
                maxLength={10000}
                placeholder="Tulis balasan…"
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              />
              <Button type="submit">Kirim</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-sm">
            {locked ? "Thread dikunci moderator." : "Masuk untuk membalas."}
          </CardContent>
        </Card>
      )}

      {moderate ? (
        <Card>
          <CardHeader>
            <CardTitle>Moderasi</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <form action={lockThread}>
              <input type="hidden" name="thread_id" value={id} />
              <input type="hidden" name="locked" value={locked ? "" : "on"} />
              <Button type="submit" size="sm" variant="outline">
                {locked ? "Buka kunci" : "Kunci"}
              </Button>
            </form>
            <form action={deleteThread}>
              <input type="hidden" name="thread_id" value={id} />
              <Button type="submit" size="sm" variant="destructive">
                Hapus thread
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
