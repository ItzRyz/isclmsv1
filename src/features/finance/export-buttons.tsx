"use client";

import { Button } from "@/components/ui/button";

export type FinanceRow = {
  date: string;
  account: string;
  category: string;
  type: string;
  description: string;
  amount: number;
};

function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

export function ExportFinanceButtons({ rows }: { rows: FinanceRow[] }) {
  function download(): void {
    const header = "tanggal,akun,kategori,tipe,deskripsi,jumlah";
    const lines = rows.map((r) =>
      [
        csvCell(r.date),
        csvCell(r.account),
        csvCell(r.category),
        csvCell(r.type),
        csvCell(r.description),
        csvCell(r.amount),
      ].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "laporan-keuangan.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={download}
      disabled={rows.length === 0}
    >
      Export CSV ({rows.length})
    </Button>
  );
}
