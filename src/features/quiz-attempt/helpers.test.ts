import { describe, expect, test } from "bun:test";
import { attemptDeadline } from "./helpers";

describe("attemptDeadline", () => {
  const start = "2026-10-10T10:00:00.000Z";

  test("null tanpa batas waktu", () => {
    expect(attemptDeadline(start, null)).toBeNull();
  });

  test("batas = mulai + limit detik", () => {
    expect(attemptDeadline(start, 3600)).toBe(
      new Date(start).getTime() + 3600 * 1000,
    );
  });

  test("batas 0/negatif diperlakukan tanpa batas", () => {
    expect(attemptDeadline(start, 0)).toBeNull();
  });
});
