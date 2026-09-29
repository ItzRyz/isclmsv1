import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createDivision } from "@/features/divisions/actions";

export default async function DivisionsPage() {
  const supabase = await createClient();
  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name, code, slug, status")
    .order("name");
  const manageable = await can("division.create").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Divisi</h1>

      <div className="grid gap-4">
        {(divisions ?? []).map((d) => (
          <Link key={d.id} href={`/divisions/${d.id}`}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {d.name} <Badge variant="secondary">{d.code}</Badge>
                  <Badge>{d.status}</Badge>
                </CardTitle>
                <CardDescription>{d.slug}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
        {(divisions ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Belum ada divisi.
            </CardContent>
          </Card>
        ) : null}
      </div>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Divisi baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createDivision} className="flex flex-col gap-3">
              <Input
                name="name"
                placeholder="Nama divisi"
                required
                minLength={3}
                maxLength={120}
              />
              <div className="flex gap-3">
                <Input
                  name="code"
                  placeholder="KODE (huruf/angka)"
                  required
                  minLength={2}
                  maxLength={16}
                />
                <Input
                  name="slug"
                  placeholder="slug-divisi"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </div>
              <Input
                name="description"
                placeholder="Deskripsi"
                maxLength={2000}
              />
              <Button type="submit">Buat divisi</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
