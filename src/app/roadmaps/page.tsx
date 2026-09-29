import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createRoadmap } from "@/features/roadmaps/actions";

export default async function RoadmapsPage() {
  const supabase = await createClient();
  const { data: roadmaps } = await supabase
    .from("roadmaps")
    .select("id, name, slug, status, divisions(name, code)")
    .order("created_at", { ascending: false });
  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .order("name");
  const manageable = await can("roadmap.manage").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Roadmap</h1>

      <div className="grid gap-4">
        {(
          (roadmaps ?? []) as {
            id: string;
            name: string;
            slug: string;
            status: string;
            divisions:
              | { name: string; code: string }
              | { name: string; code: string }[]
              | null;
          }[]
        ).map((r) => {
          const div = Array.isArray(r.divisions) ? r.divisions[0] : r.divisions;
          return (
            <Link key={r.id} href={`/roadmaps/${r.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {r.name}
                    <Badge>{r.status}</Badge>
                    {div ? <Badge variant="secondary">{div.code}</Badge> : null}
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
        {(roadmaps ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada roadmap.
            </CardContent>
          </Card>
        ) : null}
      </div>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Roadmap baru (DRAFT)</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createRoadmap} className="flex flex-col gap-3">
              <Input
                name="name"
                placeholder="Nama roadmap"
                required
                minLength={3}
                maxLength={160}
              />
              <div className="flex gap-3">
                <Input
                  name="slug"
                  placeholder="slug-roadmap"
                  required
                  minLength={2}
                  maxLength={80}
                />
                <select
                  name="division_id"
                  required
                  defaultValue=""
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Pilih divisi
                  </option>
                  {(divisions ?? []).map((d: { id: string; name: string }) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                name="description"
                placeholder="Deskripsi"
                maxLength={4000}
              />
              <Button type="submit">Buat roadmap</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
