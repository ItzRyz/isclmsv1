"use client";

import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";

export type ReportPdfData = {
  student: string;
  period: string;
  total: number;
  letter: string;
  items: {
    component: string;
    score: number;
    weight: number;
    weighted: number;
  }[];
};

export function DownloadReportPdf({ report }: { report: ReportPdfData }) {
  function download(): void {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text("Rapor Hasil Belajar — Study Club", 14, y);
    y += 10;
    doc.setFontSize(11);
    doc.text(`Peserta: ${report.student}`, 14, y);
    y += 7;
    doc.text(`Periode: ${report.period}`, 14, y);
    y += 10;
    doc.text("Komponen | Skor | Bobot | Terbobot", 14, y);
    y += 7;
    for (const it of report.items) {
      doc.text(
        `${it.component} | ${it.score} | ${it.weight} | ${it.weighted}`,
        14,
        y,
      );
      y += 7;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    }
    y += 3;
    doc.setFontSize(13);
    doc.text(`Total: ${report.total} (${report.letter})`, 14, y);
    doc.save(`rapor-${report.student.replace(/\s+/g, "-")}.pdf`);
  }

  return (
    <Button size="sm" variant="outline" onClick={download}>
      Unduh PDF
    </Button>
  );
}
