import { describe, expect, test } from "bun:test";
import {
  assertTransition,
  decideSubmitStatus,
  isEditableStatus,
} from "./status";

describe("decideSubmitStatus", () => {
  const base = {
    due_at: "2026-10-10T00:00:00.000Z",
    allow_late_submission: false,
    late_until: null as string | null,
  };

  test("sebelum due -> SUBMITTED", () => {
    expect(
      decideSubmitStatus(base, new Date("2026-10-09T00:00:00.000Z").getTime()),
    ).toBe("SUBMITTED");
  });

  test("tepat saat due -> SUBMITTED", () => {
    expect(
      decideSubmitStatus(base, new Date("2026-10-10T00:00:00.000Z").getTime()),
    ).toBe("SUBMITTED");
  });

  test("lewat due tanpa toleransi -> DEADLINE_PASSED", () => {
    expect(() =>
      decideSubmitStatus(base, new Date("2026-10-11T00:00:00.000Z").getTime()),
    ).toThrow("DEADLINE_PASSED");
  });

  test("dalam jendela late -> LATE", () => {
    expect(
      decideSubmitStatus(
        {
          ...base,
          allow_late_submission: true,
          late_until: "2026-10-12T00:00:00.000Z",
        },
        new Date("2026-10-11T00:00:00.000Z").getTime(),
      ),
    ).toBe("LATE");
  });

  test("lewat late_until -> DEADLINE_PASSED", () => {
    expect(() =>
      decideSubmitStatus(
        {
          ...base,
          allow_late_submission: true,
          late_until: "2026-10-12T00:00:00.000Z",
        },
        new Date("2026-10-13T00:00:00.000Z").getTime(),
      ),
    ).toThrow("DEADLINE_PASSED");
  });

  test("allow tanpa late_until -> DEADLINE_PASSED", () => {
    expect(() =>
      decideSubmitStatus(
        { ...base, allow_late_submission: true },
        new Date("2026-10-11T00:00:00.000Z").getTime(),
      ),
    ).toThrow("DEADLINE_PASSED");
  });
});

describe("isEditableStatus", () => {
  test("DRAFT/REVISION_REQUIRED/NOT_STARTED editable", () => {
    expect(isEditableStatus("DRAFT")).toBe(true);
    expect(isEditableStatus("REVISION_REQUIRED")).toBe(true);
    expect(isEditableStatus("NOT_STARTED")).toBe(true);
  });

  test("final/graded terkunci", () => {
    for (const s of ["SUBMITTED", "LATE", "GRADED", "RESUBMITTED"]) {
      expect(isEditableStatus(s)).toBe(false);
    }
  });
});

describe("assertTransition", () => {
  test("alur normal lolos", () => {
    expect(() => assertTransition("DRAFT", "SUBMITTED")).not.toThrow();
    expect(() => assertTransition("DRAFT", "LATE")).not.toThrow();
    expect(() => assertTransition("SUBMITTED", "GRADED")).not.toThrow();
    expect(() =>
      assertTransition("SUBMITTED", "REVISION_REQUIRED"),
    ).not.toThrow();
    expect(() =>
      assertTransition("REVISION_REQUIRED", "RESUBMITTED"),
    ).not.toThrow();
    expect(() => assertTransition("RESUBMITTED", "GRADED")).not.toThrow();
  });

  test("transisi ilegal ditolak", () => {
    expect(() => assertTransition("GRADED", "DRAFT")).toThrow(
      "TRANSITION_INVALID",
    );
    expect(() => assertTransition("DRAFT", "GRADED")).toThrow(
      "TRANSITION_INVALID",
    );
    expect(() => assertTransition("SUBMITTED", "DRAFT")).toThrow(
      "TRANSITION_INVALID",
    );
    expect(() => assertTransition("NOPE", "DRAFT")).toThrow(
      "TRANSITION_INVALID",
    );
  });
});
