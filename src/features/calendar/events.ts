/**
 * P1-205: abstraksi event kalender.
 * Sumber Fase 2: periode akademik + batch (rentang org, publik internal)
 * dan kelas anggota (role-aware). Sumber tabel events menyusul Fase 9 —
 * bentuk CalendarEvent dirancang agar sumber baru tinggal ditambahkan.
 */
export type CalendarSource = "period" | "batch" | "class";

export type CalendarEvent = {
  id: string;
  title: string;
  source: CalendarSource;
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD atau null (sehari) */
  end: string | null;
  divisionId: string | null;
  classId: string | null;
};

export type CalendarScope = {
  userId: string | null;
  divisionIds: string[];
  classIds: string[];
  canViewAll: boolean;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value: unknown): value is string {
  return typeof value === "string" && DAY_RE.test(value);
}

/**
 * Aturan visibilitas:
 * - Tanpa sesi: tidak ada event.
 * - Rentang org (period/batch): semua user terautentikasi.
 * - Entri kelas: anggota kelas tsb, atau pemilik akses luas (koordinator/
 *   pimpinan via canViewAll yang diturunkan dari permission di page).
 */
export function visibleEvents(
  events: CalendarEvent[],
  scope: CalendarScope,
): CalendarEvent[] {
  if (!scope.userId) return [];
  return events.filter((e) => {
    if (e.source === "period" || e.source === "batch") return true;
    if (scope.canViewAll) return true;
    if (e.classId && scope.classIds.includes(e.classId)) return true;
    if (e.divisionId && scope.divisionIds.includes(e.divisionId)) return true;
    return false;
  });
}

/** Event yang bersinggungan dengan bulan (year, month1based). */
export function eventsInMonth(
  events: CalendarEvent[],
  year: number,
  month1Based: number,
): CalendarEvent[] {
  const first = `${year}-${String(month1Based).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month1Based, 0).getDate();
  const last = `${year}-${String(month1Based).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return events.filter((e) => e.start <= last && (e.end ?? e.start) >= first);
}
