import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createCompetition } from "@/features/competitions/actions";

export default async function CompetitionsPage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("competitions")
    .select("id, name, status")
    .order("created_at", { ascending: false });
  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .order("name");
  const manageable = await can("event.create").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Kompetisi</h1>

      <div className="grid gap-3">
        {((items ?? []) as { id: string; name: string; status: string }[]).map(
          (c) => (
            <Link key={c.id} href={`/competitions/${c.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {c.name} <Badge>{c.status}</Badge>
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ),
        )}
        {(items ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada kompetisi.
            </CardContent>
          </Card>
        ) : null}
      </div>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Kompetisi baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createCompetition} className="flex flex-col gap-3">
              <Input
                name="name"
                placeholder="Nama kompetisi"
                required
                minLength={3}
                maxLength={160}
              />
              <div className="flex gap-3">
                <Input
                  name="slug"
                  placeholder="slug"
                  required
                  minLength={2}
                  maxLength={80}
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
              <Button type="submit">Buat kompetisi</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
