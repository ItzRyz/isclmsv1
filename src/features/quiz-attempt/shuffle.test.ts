import { describe, expect, test } from "bun:test";
import { hashSeed, seededShuffle } from "./shuffle";

describe("seededShuffle", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h"];

  test("deterministik: seed sama -> urutan sama", () => {
    expect(seededShuffle(items, "attempt-1")).toEqual(
      seededShuffle(items, "attempt-1"),
    );
  });

  test("seed beda -> urutan (sangat mungkin) beda", () => {
    const orders = new Set(
      ["a1", "a2", "a3", "a4", "a5"].map((s) =>
        seededShuffle(items, s).join(","),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  test("tidak mengubah input, isi tetap (permutasi)", () => {
    const out = seededShuffle(items, "x");
    expect([...out].sort()).toEqual([...items].sort());
    expect(items).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  test("hash stabil", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });

  test("list kosong/tunggal aman", () => {
    expect(seededShuffle([], "x")).toEqual([]);
    expect(seededShuffle(["s"], "x")).toEqual(["s"]);
  });
});
