import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { addComment, deleteComment } from "./actions";

/** Diskusi per materi (soft-delete milik sendiri, moderasi forum.moderate). */
export async function CommentSection({ materialId }: { materialId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: comments } = await supabase
    .from("material_comments")
    .select("id, author_id, body, created_at, profiles(full_name)")
    .eq("material_id", materialId)
    .is("deleted_at", null)
    .order("created_at");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Komentar ({((comments ?? []) as unknown[]).length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {(
          (comments ?? []) as unknown as {
            id: string;
            author_id: string;
            body: string;
            created_at: string;
            profiles:
              | { full_name: string | null }
              | { full_name: string | null }[]
              | null;
          }[]
        ).map((c) => {
          const prof = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          return (
            <div
              key={c.id}
              className="flex flex-col gap-1 rounded-md border p-2"
            >
              <div className="text-muted-foreground flex items-center gap-2">
                <span className="text-foreground font-medium">
                  {prof?.full_name ?? "—"}
                </span>
                <span>{new Date(c.created_at).toLocaleString("id-ID")}</span>
                {user?.id === c.author_id ? (
                  <form action={deleteComment} className="ml-auto">
                    <input type="hidden" name="comment_id" value={c.id} />
                    <input
                      type="hidden"
                      name="material_id"
                      value={materialId}
                    />
                    <Button type="submit" size="sm" variant="ghost">
                      Hapus
                    </Button>
                  </form>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </div>
          );
        })}
        {user ? (
          <form
            action={addComment}
            className="flex flex-col gap-2 border-t pt-3"
          >
            <input type="hidden" name="material_id" value={materialId} />
            <textarea
              name="body"
              rows={2}
              required
              minLength={1}
              maxLength={5000}
              placeholder="Tulis komentar…"
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm">
              Kirim
            </Button>
          </form>
        ) : (
          <span className="text-muted-foreground">
            Masuk untuk berkomentar.
          </span>
        )}
      </CardContent>
    </Card>
  );
}
