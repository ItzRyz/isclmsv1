"use client";

import { Button } from "@/components/ui/button";

export type ReportRow = {
  session: string;
  starts_at: string;
  member: string;
  status: string;
  method: string;
  checked_in_at: string;
  distance: number | null;
};

function csvCell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export function ExportCsv({ rows }: { rows: ReportRow[] }) {
  function download(): void {
    const header = "sesi,mulai,anggota,status,metode,check_in,jarak_m";
    const lines = rows.map((r) =>
      [
        csvCell(r.session),
        csvCell(r.starts_at),
        csvCell(r.member),
        csvCell(r.status),
        csvCell(r.method),
        csvCell(r.checked_in_at),
        csvCell(r.distance),
      ].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "laporan-absensi.csv";
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
