import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createClass } from "@/features/classes/actions";

export default async function ClassesPage() {
  const supabase = await createClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, code, status, divisions(name, code)")
    .order("name");
  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name, code")
    .eq("status", "ACTIVE")
    .order("name");
  const { data: batches } = await supabase
    .from("batches")
    .select("id, name")
    .order("name");
  const { data: periods } = await supabase
    .from("academic_periods")
    .select("id, name")
    .order("name");
  const manageable = await can("class.create").catch(() => false);
  const one = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Kelas</h1>

      <div className="grid gap-4">
        {(
          (classes ?? []) as {
            id: string;
            name: string;
            code: string;
            status: string;
            divisions:
              | { name: string; code: string }
              | { name: string; code: string }[]
              | null;
          }[]
        ).map((c) => {
          const div = one(c.divisions);
          return (
            <Link key={c.id} href={`/classes/${c.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {c.name} <Badge variant="outline">{c.code}</Badge>
                    <Badge>{c.status}</Badge>
                    {div ? <Badge variant="secondary">{div.code}</Badge> : null}
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
        {(classes ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada kelas.
            </CardContent>
          </Card>
        ) : null}
      </div>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Kelas baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createClass} className="flex flex-col gap-3">
              <Input
                name="name"
                placeholder="Nama kelas"
                required
                minLength={3}
                maxLength={120}
              />
              <div className="flex gap-3">
                <Input
                  name="code"
                  placeholder="KODE"
                  required
                  minLength={2}
                  maxLength={32}
                />
                <Input
                  name="capacity"
                  type="number"
                  min={1}
                  max={10000}
                  placeholder="Kapasitas (opsional)"
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
              <div className="flex gap-3">
                <select
                  name="batch_id"
                  defaultValue=""
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Tanpa batch</option>
                  {(batches ?? []).map((b: { id: string; name: string }) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <select
                  name="academic_period_id"
                  defaultValue=""
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Tanpa periode</option>
                  {(periods ?? []).map((p: { id: string; name: string }) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit">Buat kelas</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
