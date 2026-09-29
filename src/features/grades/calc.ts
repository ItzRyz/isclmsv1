/**
 * P1-703: kalkulasi nilai server — murni, deterministik, teruji.
 * normalized = raw/max*100 (dijepit 0..100).
 * total = Σ(normalized × weight) / Σ(weight), dibulatkan half-up 2 desimal.
 * Bobot 0 / tanpa bobot -> total 0 (eksplisit, bukan NaN).
 */
export type GradePart = {
  componentId: string;
  raw: number;
  max: number;
  weight: number;
};

export type WeightedPart = GradePart & {
  normalized: number;
  weighted: number;
};

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function normalize(raw: number, max: number): number {
  if (!(max > 0)) throw new Error("VALIDATION_ERROR: max_score harus > 0");
  return Math.min(100, Math.max(0, (raw / max) * 100));
}

export function weightedTotal(parts: GradePart[]): {
  total: number;
  parts: WeightedPart[];
} {
  const detailed = parts.map((p) => {
    const normalized = round2(normalize(p.raw, p.max));
    return {
      ...p,
      normalized,
      weighted: round2((normalized * p.weight) / 100),
    };
  });
  const weightSum = detailed.reduce((s, p) => s + p.weight, 0);
  if (weightSum <= 0) return { total: 0, parts: detailed };
  const total = round2(
    detailed.reduce((s, p) => s + p.normalized * p.weight, 0) / weightSum,
  );
  return { total, parts: detailed };
}
