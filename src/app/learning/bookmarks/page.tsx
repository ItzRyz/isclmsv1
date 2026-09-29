import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function BookmarksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Bookmark</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Masuk dulu untuk melihat simpanan.
          </CardContent>
        </Card>
      </main>
    );
  }

  const { data: marks } = await supabase
    .from("material_bookmarks")
    .select("material_id, created_at, materials(id, title, type, status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Materi tersimpan</h1>
      <div className="grid gap-3">
        {(
          (marks ?? []) as {
            material_id: string;
            materials:
              | {
                  id: string;
                  title: string;
                  type: string;
                  status: string;
                }
              | {
                  id: string;
                  title: string;
                  type: string;
                  status: string;
                }[]
              | null;
          }[]
        ).map((m) => {
          const mat = Array.isArray(m.materials) ? m.materials[0] : m.materials;
          if (!mat) return null;
          return (
            <Link key={m.material_id} href={`/materials/${mat.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {mat.title}
                    <Badge variant="outline">{mat.type}</Badge>
                    <Badge>{mat.status}</Badge>
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
        {(marks ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada simpanan.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
