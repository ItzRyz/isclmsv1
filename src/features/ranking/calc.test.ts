import { describe, expect, it } from "bun:test";
import { average, scoreRanking, withRanks } from "./calc";

const totals = new Map<string, { points: number; grades: number[] }>([
  ["u1", { points: 50, grades: [80, 90] }],
  ["u2", { points: 120, grades: [70] }],
  ["u3", { points: 10, grades: [] }],
]);

describe("average", () => {
  it("rata-rata biasa", () => {
    expect(average([80, 90])).toBe(85);
  });
  it("tanpa nilai = 0 eksplisit", () => {
    expect(average([])).toBe(0);
  });
});

describe("scoreRanking", () => {
  it("POINTS: urut desc berdasarkan total poin", () => {
    const r = scoreRanking("POINTS", totals);
    expect(r.map((x) => x.userId)).toEqual(["u2", "u1", "u3"]);
    expect(r[0]?.score).toBe(120);
  });

  it("GRADES: skor = rata-rata normalized, tanpa nilai = 0", () => {
    const r = scoreRanking("GRADES", totals);
    expect(r.map((x) => x.userId)).toEqual(["u1", "u2", "u3"]);
    expect(r[0]?.score).toBe(85);
    expect(r[2]?.score).toBe(0);
  });

  it("MIXED: poin + rata-rata", () => {
    const r = scoreRanking("MIXED", totals);
    const u1 = r.find((x) => x.userId === "u1");
    expect(u1?.score).toBe(135);
  });

  it("dibulatkan 2 desimal", () => {
    const m = new Map([["a", { points: 0, grades: [66.666] }]]);
    expect(scoreRanking("GRADES", m)[0]?.score).toBe(66.67);
  });

  it("deterministik: input sama -> output sama persis", () => {
    expect(scoreRanking("MIXED", totals)).toEqual(
      scoreRanking("MIXED", totals),
    );
  });
});

describe("withRanks", () => {
  it("peringkat 1-based berurutan", () => {
    const r = withRanks(scoreRanking("POINTS", totals));
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3]);
  });

  it("skor sama -> urutan mengikuti input (stabil)", () => {
    const tie = new Map([
      ["a", { points: 10, grades: [] }],
      ["b", { points: 10, grades: [] }],
    ]);
    expect(withRanks(scoreRanking("POINTS", tie)).map((x) => x.userId)).toEqual(
      ["a", "b"],
    );
  });
});
