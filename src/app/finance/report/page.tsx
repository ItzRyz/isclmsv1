import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { ExportFinanceButtons } from "@/features/finance/export-buttons";

function rupiah(n: number): string {
  return `Rp${Number(n).toLocaleString("id-ID")}`;
}

export default async function FinanceReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = (() => {
    const v = sp["month"];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  })();
  const now = new Date();
  const month = /^\d{4}-\d{2}$/.test(raw)
    ? raw
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const start = `${month}-01`;
  const endDay = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const end = `${month}-${String(endDay).padStart(2, "0")}`;

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
  const { data: rows } = await supabase
    .from("financial_transactions")
    .select(
      "type, amount, description, transaction_date, financial_accounts(name), financial_categories(name)",
    )
    .gte("transaction_date", start)
    .lte("transaction_date", end)
    .order("transaction_date")
    .limit(1000);

  const list = (
    (rows ?? []) as unknown as {
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
    return {
      date: t.transaction_date,
      account: acc?.name ?? "—",
      category: cat?.name ?? "—",
      type: t.type,
      description: t.description,
      amount: Number(t.amount),
    };
  });
  const income = list
    .filter((r) => r.type === "INCOME")
    .reduce((s, r) => s + r.amount, 0);
  const expense = list
    .filter((r) => r.type === "EXPENSE")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Laporan {month}</h1>
        <ExportFinanceButtons rows={list} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-sm">
            <div className="text-muted-foreground">Pemasukan</div>
            <div className="text-primary text-lg font-semibold">
              {rupiah(income)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-sm">
            <div className="text-muted-foreground">Pengeluaran</div>
            <div className="text-destructive text-lg font-semibold">
              {rupiah(expense)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-sm">
            <div className="text-muted-foreground">Surplus</div>
            <div className="text-lg font-semibold">
              {rupiah(income - expense)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex gap-2">
            <Input name="month" type="month" defaultValue={month} />
            <Button type="submit" size="sm">
              Tampilkan
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1 pt-6 text-sm">
          {list.map((r, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 border-b py-1 last:border-0"
            >
              <span className="text-muted-foreground">{r.date}</span>
              <span className="flex-1">{r.description}</span>
              <Badge variant="outline">{r.account}</Badge>
              <Badge variant={r.type === "INCOME" ? "default" : "secondary"}>
                {r.type === "INCOME" ? "+" : "-"}
                {rupiah(r.amount)}
              </Badge>
            </div>
          ))}
          {list.length === 0 ? (
            <span className="text-muted-foreground">
              Tidak ada transaksi bulan ini.
            </span>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
