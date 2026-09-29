import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createCourse } from "@/features/courses/actions";

export default async function LearningPage() {
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("id, name, code, status, divisions(name, code)")
    .order("created_at", { ascending: false });
  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .order("name");
  const manageable = await can("course.create").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Pembelajaran</h1>

      <div className="grid gap-4">
        {(
          (courses ?? []) as {
            id: string;
            name: string;
            code: string | null;
            status: string;
            divisions:
              | { name: string; code: string }
              | { name: string; code: string }[]
              | null;
          }[]
        ).map((c) => {
          const div = Array.isArray(c.divisions) ? c.divisions[0] : c.divisions;
          return (
            <Link key={c.id} href={`/courses/${c.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {c.name}
                    {c.code ? <Badge variant="outline">{c.code}</Badge> : null}
                    <Badge>{c.status}</Badge>
                    {div ? <Badge variant="secondary">{div.code}</Badge> : null}
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
        {(courses ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada course. Draf hanya terlihat staf.
            </CardContent>
          </Card>
        ) : null}
      </div>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Course baru (mulai sebagai DRAFT)</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createCourse} className="flex flex-col gap-3">
              <Input
                name="name"
                placeholder="Nama course"
                required
                minLength={3}
                maxLength={160}
              />
              <div className="flex gap-3">
                <Input
                  name="slug"
                  placeholder="slug-course"
                  required
                  minLength={2}
                  maxLength={80}
                />
                <Input
                  name="code"
                  placeholder="KODE (opsional)"
                  maxLength={32}
                />
              </div>
              <select
                name="division_id"
                required
                defaultValue=""
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
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
              <Input
                name="description"
                placeholder="Deskripsi"
                maxLength={4000}
              />
              <div className="flex gap-3">
                <Input
                  name="difficulty"
                  placeholder="Kesulitan (opsional)"
                  maxLength={32}
                />
                <Input
                  name="estimated_hours"
                  type="number"
                  min={1}
                  max={10000}
                  placeholder="Estimasi jam"
                />
              </div>
              <Button type="submit">Buat course</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
