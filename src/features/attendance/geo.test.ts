import { describe, expect, test } from "bun:test";
import { haversineMeters, roundCoord } from "./geo";

describe("haversineMeters", () => {
  test("titik sama = 0", () => {
    expect(haversineMeters(-6.2, 106.8, -6.2, 106.8)).toBe(0);
  });

  test("Jakarta-Monas ke Bundaran HI ~ 1.2 km", () => {
    // Monas (-6.1754, 106.8272) -> Bundaran HI (-6.1944, 106.8229)
    const d = haversineMeters(-6.1754, 106.8272, -6.1944, 106.8229);
    expect(d).toBeGreaterThan(1500);
    expect(d).toBeLessThan(3000);
  });

  test("100 m terdeteksi dalam radius", () => {
    // ~90 m ke utara (0.0008 derajat lintang)
    const d = haversineMeters(-6.2, 106.8, -6.1992, 106.8);
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(150);
  });

  test("simetris", () => {
    const a = haversineMeters(-6.2, 106.8, -6.3, 106.9);
    const b = haversineMeters(-6.3, 106.9, -6.2, 106.8);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });
});

describe("roundCoord", () => {
  test("potong 3 desimal", () => {
    expect(roundCoord(-6.17549)).toBe(-6.175);
    expect(roundCoord(106.82729)).toBe(106.827);
  });
});
