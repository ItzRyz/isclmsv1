import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { awardPoints } from "@/features/points/actions";
import { POINT_TYPES } from "@/features/points/schemas";

export default async function PointsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const manageable = await can("point.manage").catch(() => false);
  const viewAll = await can("point.view").catch(() => false);

  const query =
    manageable || viewAll
      ? supabase
          .from("point_transactions")
          .select(
            "id, user_id, amount, point_type, description, created_at, profiles(full_name)",
          )
          .order("created_at", { ascending: false })
          .limit(50)
      : user
        ? supabase
            .from("point_transactions")
            .select("id, amount, point_type, description, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50)
        : { data: [] as unknown[] };
  const { data: rows } = await query;

  const ownOnly = !viewAll && !manageable;
  const balance = ownOnly
    ? ((rows ?? []) as { amount: number }[]).reduce(
        (s, r) => s + Number(r.amount),
        0,
      )
    : 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        Poin
        {ownOnly && user ? (
          <Badge variant="secondary">Saldo {balance}</Badge>
        ) : null}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {(
            (rows ?? []) as {
              id: string;
              amount: number;
              point_type: string;
              description: string;
              created_at: string;
              profiles?: { full_name: string | null } | null;
            }[]
          ).map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-2 border-b py-1 last:border-0"
            >
              <Badge
                variant={Number(r.amount) >= 0 ? "default" : "destructive"}
              >
                {Number(r.amount) >= 0 ? "+" : ""}
                {r.amount}
              </Badge>
              <span className="flex-1">{r.description}</span>
              <Badge variant="outline">{r.point_type}</Badge>
              <span className="text-muted-foreground">
                {new Date(r.created_at).toLocaleString("id-ID")}
              </span>
            </div>
          ))}
          {(rows ?? []).length === 0 ? (
            <span className="text-muted-foreground">Belum ada transaksi.</span>
          ) : null}
        </CardContent>
      </Card>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Beri / koreksi poin</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={awardPoints} className="flex flex-col gap-3">
              <Input name="user_id" placeholder="User ID (UUID)" required />
              <div className="flex gap-3">
                <Input
                  name="amount"
                  type="number"
                  placeholder="+/- poin"
                  required
                />
                <select
                  name="point_type"
                  defaultValue="MANUAL"
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  {POINT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <Input
                  name="source_type"
                  placeholder="Sumber mis. MANUAL"
                  required
                  minLength={2}
                  maxLength={64}
                />
                <Input name="source_id" placeholder="Source ID (opsional)" />
              </div>
              <Input
                name="description"
                placeholder="Deskripsi (koreksi: tulis alasan pembalik)"
                required
                minLength={3}
                maxLength={500}
              />
              <Button type="submit">Catat transaksi</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
