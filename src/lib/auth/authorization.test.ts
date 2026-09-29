import { describe, expect, test } from "bun:test";
import {
  evaluateAccess,
  type Memberships,
  type PermissionAssignment,
} from "./authorization";

const me = "user-1";
const webDiv = "div-web";
const mlDiv = "div-ml";
const classA = "class-a";

function mem(over: Partial<Memberships> = {}): Memberships {
  return { userId: me, divisionIds: [webDiv], classIds: [classA], ...over };
}

function asg(list: [string, PermissionAssignment["scope"]][]): PermissionAssignment[] {
  return list.map(([permission, scope]) => ({ permission, scope }));
}

describe("evaluateAccess", () => {
  test("deny default: tanpa assignment selalu false", () => {
    expect(evaluateAccess([], mem(), "material.update", {})).toBe(false);
  });

  test("union antar peran: salah satu cocok => allow", () => {
    const a = asg([
      ["material.view", "ORGANIZATION"],
      ["assignment.grade", "CLASS"],
    ]);
    expect(
      evaluateAccess(a, mem(), "assignment.grade", { classId: classA }),
    ).toBe(true);
  });

  test("GLOBAL bypass membership", () => {
    const a = asg([["user.assign_role", "GLOBAL"]]);
    expect(evaluateAccess(a, mem({ divisionIds: [], classIds: [] }), "user.assign_role", {})).toBe(true);
  });

  test("DIVISION: divisi benar allow, divisi lain deny", () => {
    const a = asg([["material.update", "DIVISION"]]);
    expect(evaluateAccess(a, mem(), "material.update", { divisionId: webDiv })).toBe(true);
    expect(evaluateAccess(a, mem(), "material.update", { divisionId: mlDiv })).toBe(false);
    expect(evaluateAccess(a, mem(), "material.update", {})).toBe(false);
  });

  test("CLASS: butuh keanggotaan kelas", () => {
    const a = asg([["attendance.check_in", "CLASS"]]);
    expect(evaluateAccess(a, mem(), "attendance.check_in", { classId: classA })).toBe(true);
    expect(
      evaluateAccess(a, mem({ classIds: [] }), "attendance.check_in", { classId: classA }),
    ).toBe(false);
  });

  test("OWN: hanya milik sendiri", () => {
    const a = asg([["submission.update_own", "OWN"]]);
    expect(evaluateAccess(a, mem(), "submission.update_own", { ownerId: me })).toBe(true);
    expect(evaluateAccess(a, mem(), "submission.update_own", { ownerId: "user-2" })).toBe(false);
    expect(evaluateAccess(a, mem(), "submission.update_own", {})).toBe(false);
  });

  test("permission beda tidak bocor antar resource", () => {
    const a = asg([["material.view", "ORGANIZATION"]]);
    expect(evaluateAccess(a, mem(), "material.delete", {})).toBe(false);
  });
});
