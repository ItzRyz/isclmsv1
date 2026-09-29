import { describe, expect, test } from "bun:test";
import { kkmOf, letterFor, normalize, round2, weightedTotal } from "./calc";

describe("round2", () => {
  test("half-up 2 desimal", () => {
    expect(round2(2.345)).toBe(2.35);
    expect(round2(2.344)).toBe(2.34);
    expect(round2(100)).toBe(100);
  });
});

describe("normalize", () => {
  test("skala 0-100", () => {
    expect(normalize(80, 100)).toBe(80);
    expect(normalize(1, 2)).toBe(50);
  });

  test("dijepit 0..100", () => {
    expect(normalize(-5, 100)).toBe(0);
    expect(normalize(150, 100)).toBe(100);
  });

  test("max <= 0 ditolak", () => {
    expect(() => normalize(10, 0)).toThrow();
  });
});

describe("weightedTotal", () => {
  test("reprodusibel: input sama -> output sama persis", () => {
    const parts = [
      { componentId: "a", raw: 80, max: 100, weight: 40 },
      { componentId: "b", raw: 45, max: 50, weight: 60 },
    ];
    const r1 = weightedTotal(parts);
    const r2 = weightedTotal(structuredClone(parts));
    expect(r1).toEqual(r2);
    // (80*40 + 90*60)/100 = 86
    expect(r1.total).toBe(86);
  });

  test("tanpa bobot -> 0 eksplisit", () => {
    expect(
      weightedTotal([{ componentId: "a", raw: 80, max: 100, weight: 0 }]).total,
    ).toBe(0);
    expect(weightedTotal([]).total).toBe(0);
  });

  test("bobot tidak harus berjumlah 100", () => {
    const r = weightedTotal([
      { componentId: "a", raw: 100, max: 100, weight: 1 },
      { componentId: "b", raw: 50, max: 100, weight: 1 },
    ]);
    expect(r.total).toBe(75);
  });

  test("weighted per komponen konsisten", () => {
    const r = weightedTotal([
      { componentId: "a", raw: 80, max: 100, weight: 40 },
    ]);
    expect(r.parts[0]?.weighted).toBe(32);
    expect(r.parts[0]?.normalized).toBe(80);
  });
});

describe("letterFor/kkmOf", () => {
  const scales = [
    { letter: "A", min_score: 90, max_score: 100, is_passing: true },
    { letter: "B", min_score: 75, max_score: 89, is_passing: true },
    { letter: "C", min_score: 0, max_score: 74, is_passing: false },
  ];

  test("huruf + lulus sesuai pita", () => {
    expect(letterFor(scales, 95)).toEqual({ letter: "A", passing: true });
    expect(letterFor(scales, 80)).toEqual({ letter: "B", passing: true });
    expect(letterFor(scales, 50)).toEqual({ letter: "C", passing: false });
  });

  test("KKM = bawah pita lulus", () => {
    expect(kkmOf(scales)).toBe(75);
    expect(kkmOf([])).toBeNull();
  });
});
