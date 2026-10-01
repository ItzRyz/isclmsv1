import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const allowed = await can("user.view").catch(() => false);
  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Butuh permission user.view.
          </CardContent>
        </Card>
      </main>
    );
  }

  const sp = await searchParams;
  const raw = sp["q"];
  const q = (Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "")).trim();

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, full_name, username, email, status")
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,username.ilike.%${q}%,email.ilike.%${q}%`,
    );
  }
  const { data: users } = await query;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Kelola user</h1>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex gap-2">
            <Input
              name="q"
              placeholder="Cari nama/username/email…"
              defaultValue={q}
            />
            <Button type="submit" size="sm">
              Cari
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        {(
          (users ?? []) as {
            id: string;
            full_name: string | null;
            username: string | null;
            email: string | null;
            status: string;
          }[]
        ).map((u) => (
          <Link key={u.id} href={`/admin/users/${u.id}`}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="flex items-center gap-2 pt-4 text-sm">
                <span className="flex-1 font-medium">
                  {u.full_name ?? "Tanpa nama"}
                  <span className="text-muted-foreground ml-2">
                    {u.username ? `@${u.username}` : (u.email ?? "")}
                  </span>
                </span>
                <Badge
                  variant={u.status === "ACTIVE" ? "secondary" : "destructive"}
                >
                  {u.status}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(users ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6 text-sm">
              Tidak ada hasil.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
