export type RankingTotals = { points: number; grades: number[] };

export type RankedEntry = {
  userId: string;
  score: number;
  points: number;
};

export type RankingMetric = "POINTS" | "GRADES" | "MIXED";

/** Rata-rata nilai; tanpa nilai = 0. */
export function average(grades: number[]): number {
  if (!grades.length) return 0;
  return grades.reduce((s, x) => s + x, 0) / grades.length;
}

/**
 * Skor per user sesuai metrik, dibulatkan 2 desimal, diurutkan desc.
 * POINTS = total poin; GRADES = rata-rata normalized; MIXED = poin + rata-rata.
 * Deterministik: input sama -> output sama persis.
 */
export function scoreRanking(
  metric: RankingMetric,
  totals: Iterable<[string, RankingTotals]>,
): RankedEntry[] {
  const scored = [...totals].map(([userId, v]) => {
    const avg = average(v.grades);
    const score =
      metric === "POINTS"
        ? v.points
        : metric === "GRADES"
          ? avg
          : v.points + avg;
    return { userId, score: Math.round(score * 100) / 100, points: v.points };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** Peringkat 1-based; skor sama -> urutan mengikuti input (stabil). */
export function withRanks(
  scored: RankedEntry[],
): (RankedEntry & { rank: number })[] {
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}
