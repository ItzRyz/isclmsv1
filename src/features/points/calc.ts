export type PointEntry = {
  user_id: string;
  amount: number | string;
};

/** Saldo poin = jumlah semua transaksi (koreksi = transaksi kompensasi, tidak diubah). */
export function totalPoints(entries: Pick<PointEntry, "amount">[]): number {
  return entries.reduce((s, e) => s + Number(e.amount), 0);
}

/** Agregat saldo per user, deterministik dari urutan input. */
export function balanceByUser(entries: PointEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) {
    out.set(e.user_id, (out.get(e.user_id) ?? 0) + Number(e.amount));
  }
  return out;
}
