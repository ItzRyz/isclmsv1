import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  cancelDue,
  markPaid,
  recordDue,
} from "@/features/finance/dues-actions";

function rupiah(n: number): string {
  return `Rp${Number(n).toLocaleString("id-ID")}`;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string): string => {
    const v = sp[k];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  };
  const status = get("status");
  const period = get("period");

  const manageable = await can("finance.create").catch(() => false);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("payments")
    .select(
      "id, user_id, amount, period_label, status, paid_at, transaction_id, profiles(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (!manageable && user) query = query.eq("user_id", user.id);
  if (status) query = query.eq("status", status);
  if (period) query = query.eq("period_label", period);
  const { data: rows } =
    manageable || user ? await query : { data: [] as unknown[] };

  const { data: accounts } = manageable
    ? await supabase
        .from("financial_accounts")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
    : { data: [] as unknown[] };
  const outstanding = ((rows ?? []) as { status: string; amount: number }[])
    .filter((r) => r.status === "PENDING" || r.status === "OVERDUE")
    .reduce((s, r) => s + Number(r.amount), 0);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        Iuran
        {outstanding > 0 ? (
          <Badge variant="destructive">Tunggakan {rupiah(outstanding)}</Badge>
        ) : null}
      </h1>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex gap-2">
            <select
              name="status"
              defaultValue={status}
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Semua status</option>
              <option value="PENDING">PENDING</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            <Input
              name="period"
              placeholder="Periode mis. 2026-10"
              defaultValue={period}
            />
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
              user_id: string;
              amount: number;
              period_label: string;
              status: string;
              paid_at: string | null;
              transaction_id: string | null;
              profiles: { full_name: string | null } | null;
            }[]
          ).map((r) => {
            const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-2 border-b py-1 last:border-0"
              >
                <span className="flex-1 font-medium">
                  {prof?.full_name ?? r.user_id ?? "—"}
                </span>
                <span className="text-muted-foreground">{r.period_label}</span>
                <Badge>{r.status}</Badge>
                <span>{rupiah(Number(r.amount))}</span>
                {manageable && r.status === "PENDING" ? (
                  <>
                    <form action={markPaid} className="flex gap-1">
                      <input type="hidden" name="payment_id" value={r.id} />
                      <select
                        name="account_id"
                        required
                        defaultValue=""
                        className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                      >
                        <option value="" disabled>
                          Akun
                        </option>
                        {(
                          (accounts ?? []) as { id: string; name: string }[]
                        ).map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm">
                        Lunas
                      </Button>
                    </form>
                    <form action={cancelDue}>
                      <input type="hidden" name="payment_id" value={r.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Batal
                      </Button>
                    </form>
                  </>
                ) : null}
              </div>
            );
          })}
          {(rows ?? []).length === 0 ? (
            <span className="text-muted-foreground">Tidak ada data.</span>
          ) : null}
        </CardContent>
      </Card>

      {manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>Tagih iuran</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={recordDue} className="flex flex-col gap-3">
              <div className="flex gap-3">
                <Input name="user_id" placeholder="User ID (UUID)" required />
                <Input
                  name="amount"
                  type="number"
                  min={1}
                  placeholder="Jumlah (Rp)"
                  required
                />
              </div>
              <div className="flex gap-3">
                <Input
                  name="period_label"
                  placeholder="Periode mis. 2026-10"
                  required
                  minLength={2}
                  maxLength={64}
                />
                <Input
                  name="note"
                  placeholder="Catatan (opsional)"
                  maxLength={500}
                />
              </div>
              <Button type="submit">Tagih</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
