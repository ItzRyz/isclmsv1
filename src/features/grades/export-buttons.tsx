"use client";

import { jsPDF } from "jspdf";
import { utils, writeFile } from "xlsx";
import { Button } from "@/components/ui/button";

export type GradeExportRow = {
  student: string;
  component: string;
  source: string;
  raw: number;
  normalized: number;
  weight: number;
  weighted: number;
  created_at: string;
};

function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

export function ExportGradesButtons({ rows }: { rows: GradeExportRow[] }) {
  function csv(): void {
    const header =
      "peserta,komponen,sumber,mentah,normalisasi,bobot,terbobot,dibuat";
    const lines = rows.map((r) =>
      [
        csvCell(r.student),
        csvCell(r.component),
        csvCell(r.source),
        csvCell(r.raw),
        csvCell(r.normalized),
        csvCell(r.weight),
        csvCell(r.weighted),
        csvCell(r.created_at),
      ].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nilai.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function xlsx(): void {
    const sheet = utils.json_to_sheet(
      rows.map((r) => ({
        Peserta: r.student,
        Komponen: r.component,
        Sumber: r.source,
        Mentah: r.raw,
        Normalisasi: r.normalized,
        Bobot: r.weight,
        Terbobot: r.weighted,
        Dibuat: r.created_at,
      })),
    );
    const wb = utils.book_new();
    utils.book_append_sheet(wb, sheet, "Nilai");
    writeFile(wb, "nilai.xlsx");
  }

  function pdf(): void {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Ekspor Nilai — Study Club", 14, 16);
    doc.setFontSize(9);
    let y = 26;
    doc.text("Peserta | Komponen | Mentah | Normal | Bobot | Terbobot", 14, y);
    y += 6;
    for (const r of rows.slice(0, 200)) {
      doc.text(
        `${r.student} | ${r.component} | ${r.raw} | ${r.normalized} | ${r.weight} | ${r.weighted}`,
        14,
        y,
      );
      y += 5;
      if (y > 195) {
        doc.addPage("a4", "landscape");
        y = 16;
      }
    }
    doc.save("nilai.pdf");
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={csv}
        disabled={rows.length === 0}
      >
        CSV
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={xlsx}
        disabled={rows.length === 0}
      >
        XLSX
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={pdf}
        disabled={rows.length === 0}
      >
        PDF
      </Button>
    </div>
  );
}
