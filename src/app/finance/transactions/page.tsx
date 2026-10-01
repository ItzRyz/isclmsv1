import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteTransaction,
  recordTransaction,
} from "@/features/finance/txn-actions";

function rupiah(n: number): string {
  return `Rp${Number(n).toLocaleString("id-ID")}`;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string): string => {
    const v = sp[k];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  };
  const accountId = get("account");
  const type = get("type");

  const manageable = await can("finance.create").catch(() => false);
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("financial_accounts")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const { data: categories } = await supabase
    .from("financial_categories")
    .select("id, name, kind")
    .order("kind")
    .order("name");

  let query = supabase
    .from("financial_transactions")
    .select(
      "id, type, amount, description, transaction_date, financial_accounts(name), financial_categories(name)",
    )
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (accountId) query = query.eq("account_id", accountId);
  if (type) query = query.eq("type", type);
  const { data: rows } = await query;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Transaksi</h1>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex gap-2">
            <select
              name="account"
              defaultValue={accountId}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Semua akun</option>
              {((accounts ?? []) as { id: string; name: string }[]).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              name="type"
              defaultValue={type}
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Masuk+Keluar</option>
              <option value="INCOME">INCOME</option>
              <option value="EXPENSE">EXPENSE</option>
            </select>
            <Button type="submit" size="sm">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1 pt-6 text-sm">
          {(
            (rows ?? []) as unknown as {
              id: string;
              type: string;
              amount: number;
              description: string;
              transaction_date: string;
              financial_accounts: { name: string } | null;
              financial_categories: { name: string } | null;
            }[]
          ).map((t) => {
            const acc = Array.isArray(t.financial_accounts)
              ? t.financial_accounts[0]
              : t.financial_accounts;
            const cat = Array.isArray(t.financial_categories)
              ? t.financial_categories[0]
              : t.financial_categories;
            return (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-2 border-b py-1 last:border-0"
              >
                <Badge variant={t.type === "INCOME" ? "default" : "secondary"}>
                  {t.type === "INCOME" ? "+" : "-"}
                  {rupiah(Number(t.amount))}
                </Badge>
                <span className="flex-1">{t.description}</span>
                <span className="text-muted-foreground">{acc?.name}</span>
                {cat ? <Badge variant="outline">{cat.name}</Badge> : null}
                <span className="text-muted-foreground">
                  {t.transaction_date}
                </span>
                {manageable ? (
                  <form action={deleteTransaction}>
                    <input type="hidden" name="transaction_id" value={t.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Hapus
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })}
          {(rows ?? []).length === 0 ? (
            <span className="text-muted-foreground">Belum ada transaksi.</span>
          ) : null}
        </CardContent>
      </Card>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Catat transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={recordTransaction} className="flex flex-col gap-3">
              <div className="flex gap-3">
                <select
                  name="account_id"
                  required
                  defaultValue=""
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Pilih akun
                  </option>
                  {((accounts ?? []) as { id: string; name: string }[]).map(
                    (a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ),
                  )}
                </select>
                <select
                  name="type"
                  defaultValue="EXPENSE"
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="INCOME">INCOME</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Input
                  name="amount"
                  type="number"
                  min={1}
                  step="any"
                  placeholder="Jumlah (Rp)"
                  required
                />
                <Input name="transaction_date" type="date" />
              </div>
              <Input
                name="description"
                placeholder="Deskripsi"
                required
                minLength={3}
                maxLength={500}
              />
              <div className="flex gap-3">
                <select
                  name="category_id"
                  defaultValue=""
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Tanpa kategori</option>
                  {(
                    (categories ?? []) as {
                      id: string;
                      name: string;
                      kind: string;
                    }[]
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.kind} — {c.name}
                    </option>
                  ))}
                </select>
                <Input
                  name="reference"
                  placeholder="Referensi (opsional)"
                  maxLength={200}
                />
              </div>
              <Button type="submit">Catat</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
