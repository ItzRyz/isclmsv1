import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  createAccount,
  createCategory,
  deleteCategory,
  toggleAccount,
} from "@/features/finance/actions";

function rupiah(n: number): string {
  return `Rp${Number(n).toLocaleString("id-ID")}`;
}

export default async function FinancePage() {
  const allowed = await can("finance.view").catch(() => false);
  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Butuh permission finance.view.
          </CardContent>
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("financial_accounts")
    .select("id, name, code, type, opening_balance, is_active")
    .order("name");
  const { data: categories } = await supabase
    .from("financial_categories")
    .select("id, name, kind")
    .order("kind")
    .order("name");
  const { data: txns } = await supabase
    .from("financial_transactions")
    .select("account_id, type, amount");
  const balances = new Map<string, number>();
  for (const t of (txns ?? []) as {
    account_id: string;
    type: string;
    amount: number;
  }[]) {
    const cur = balances.get(t.account_id) ?? 0;
    balances.set(
      t.account_id,
      cur + (t.type === "INCOME" ? Number(t.amount) : -Number(t.amount)),
    );
  }
  const manageable = await can("finance.create").catch(() => false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Keuangan</h1>

      <Card>
        <CardHeader>
          <CardTitle>Akun</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {(
            (accounts ?? []) as {
              id: string;
              name: string;
              code: string;
              type: string;
              opening_balance: number;
              is_active: boolean;
            }[]
          ).map((a) => {
            const balance =
              Number(a.opening_balance) + (balances.get(a.id) ?? 0);
            return (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-2 border-b py-1 last:border-0"
              >
                <span className="flex-1 font-medium">{a.name}</span>
                <Badge variant="outline">{a.code}</Badge>
                <Badge variant="outline">{a.type}</Badge>
                <Badge variant={balance < 0 ? "destructive" : "secondary"}>
                  {rupiah(balance)}
                </Badge>
                {!a.is_active ? <Badge>Nonaktif</Badge> : null}
                {manageable ? (
                  <form action={toggleAccount}>
                    <input type="hidden" name="account_id" value={a.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      {a.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })}
          {(accounts ?? []).length === 0 ? (
            <span className="text-muted-foreground">Belum ada akun.</span>
          ) : null}
          {manageable ? (
            <form
              action={createAccount}
              className="mt-2 flex flex-col gap-2 border-t pt-3"
            >
              <div className="flex gap-2">
                <Input
                  name="name"
                  placeholder="Nama akun"
                  required
                  minLength={2}
                  maxLength={120}
                />
                <Input
                  name="code"
                  placeholder="KODE"
                  required
                  minLength={2}
                  maxLength={32}
                />
              </div>
              <div className="flex gap-2">
                <select
                  name="type"
                  defaultValue="CASH"
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="CASH">CASH</option>
                  <option value="BANK">BANK</option>
                  <option value="EWALLET">EWALLET</option>
                </select>
                <Input
                  name="opening_balance"
                  type="number"
                  min={0}
                  defaultValue={0}
                  required
                />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" name="is_active" defaultChecked />
                  Aktif
                </label>
                <Button type="submit" size="sm">
                  Tambah
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kategori</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {(
            (categories ?? []) as { id: string; name: string; kind: string }[]
          ).map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-1">
              <span className="flex-1">{c.name}</span>
              <Badge variant={c.kind === "INCOME" ? "default" : "secondary"}>
                {c.kind}
              </Badge>
              {manageable ? (
                <form action={deleteCategory}>
                  <input type="hidden" name="category_id" value={c.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Hapus
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
          {manageable ? (
            <form
              action={createCategory}
              className="mt-2 flex gap-2 border-t pt-3"
            >
              <Input
                name="name"
                placeholder="Nama kategori"
                required
                minLength={2}
                maxLength={120}
              />
              <select
                name="kind"
                defaultValue="EXPENSE"
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                <option value="INCOME">INCOME</option>
                <option value="EXPENSE">EXPENSE</option>
              </select>
              <Button type="submit" size="sm">
                Tambah
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
