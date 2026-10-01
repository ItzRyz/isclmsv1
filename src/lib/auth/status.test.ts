import { describe, expect, it } from "bun:test";
import { isProfileActive } from "./status";

describe("isProfileActive", () => {
  it("ACTIVE diizinkan", () => {
    expect(isProfileActive("ACTIVE")).toBe(true);
  });

  it("INACTIVE ditolak", () => {
    expect(isProfileActive("INACTIVE")).toBe(false);
  });

  it("SUSPENDED ditolak", () => {
    expect(isProfileActive("SUSPENDED")).toBe(false);
  });

  it("tanpa profil / null / undefined = deny default", () => {
    expect(isProfileActive(null)).toBe(false);
    expect(isProfileActive(undefined)).toBe(false);
  });

  it("status tak dikenal = deny default", () => {
    expect(isProfileActive("HACKED")).toBe(false);
    expect(isProfileActive("")).toBe(false);
  });
});
