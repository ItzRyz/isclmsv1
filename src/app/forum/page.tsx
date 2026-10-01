import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createThread } from "@/features/forum/actions";

export default async function ForumPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("forum_categories")
    .select("id, name, description")
    .order("position");
  const { data: threads } = await supabase
    .from("forum_threads")
    .select("id, category_id, title, locked_at, created_at, accepted_post_id")
    .order("created_at", { ascending: false })
    .limit(50);
  const writable = await can("forum.create").catch(() => false);

  const byCat = new Map<
    string,
    { id: string; title: string; locked_at: string | null; accepted: boolean }[]
  >();
  for (const t of (threads ?? []) as {
    id: string;
    category_id: string;
    title: string;
    locked_at: string | null;
    accepted_post_id: string | null;
  }[]) {
    byCat.set(t.category_id, [
      ...(byCat.get(t.category_id) ?? []),
      {
        id: t.id,
        title: t.title,
        locked_at: t.locked_at,
        accepted: !!t.accepted_post_id,
      },
    ]);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Forum diskusi</h1>

      {(
        (categories ?? []) as {
          id: string;
          name: string;
          description: string | null;
        }[]
      ).map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <CardTitle>{c.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {(byCat.get(c.id) ?? []).map((t) => (
              <Link
                key={t.id}
                href={`/forum/${t.id}`}
                className="flex items-center gap-2 py-1 hover:underline"
              >
                <span className="flex-1">{t.title}</span>
                {t.accepted ? (
                  <Badge variant="secondary">Terjawab ✓</Badge>
                ) : null}
                {t.locked_at ? (
                  <Badge variant="destructive">Terkunci</Badge>
                ) : null}
              </Link>
            ))}
            {(byCat.get(c.id) ?? []).length === 0 ? (
              <span className="text-muted-foreground">Belum ada thread.</span>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {writable ? (
        <Card>
          <CardHeader>
            <CardTitle>Thread baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createThread} className="flex flex-col gap-3">
              <select
                name="category_id"
                required
                defaultValue=""
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Pilih kategori
                </option>
                {((categories ?? []) as { id: string; name: string }[]).map(
                  (cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ),
                )}
              </select>
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
                minLength={1}
                maxLength={10000}
                placeholder="Tulis postingan pertama…"
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              />
              <Button type="submit">Buat thread</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
