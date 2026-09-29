/**
 * P1-402/404: status submission ditentukan SERVER (bukan payload browser).
 * Aturan: sebelum due -> SUBMITTED; lewat due tapi dalam toleransi late
 * (allow + late_until) -> LATE; selain itu DEADLINE_PASSED.
 */
export type SubmitOutcome = "SUBMITTED" | "LATE";

export function decideSubmitStatus(
  assignment: {
    due_at: string;
    allow_late_submission: boolean;
    late_until: string | null;
  },
  nowMs: number,
): SubmitOutcome {
  const due = new Date(assignment.due_at).getTime();
  if (nowMs <= due) return "SUBMITTED";
  if (
    assignment.allow_late_submission &&
    assignment.late_until &&
    nowMs <= new Date(assignment.late_until).getTime()
  ) {
    return "LATE";
  }
  throw new Error("DEADLINE_PASSED: batas pengumpulan sudah lewat");
}

/** Status yang masih boleh diubah pemiliknya (draf / revisi diminta). */
export function isEditableStatus(status: string): boolean {
  return (
    status === "DRAFT" ||
    status === "REVISION_REQUIRED" ||
    status === "NOT_STARTED"
  );
}

/**
 * P1-404: mesin status submission.
 * NOT_STARTED -> DRAFT -> SUBMITTED/LATE -> GRADED
 * SUBMITTED/LATE -> REVISION_REQUIRED -> RESUBMITTED -> GRADED
 * GRADED terminal (perubahan nilai = koreksi via revisi/feedback baru).
 */
const TRANSITIONS: Record<string, string[]> = {
  NOT_STARTED: ["DRAFT"],
  DRAFT: ["SUBMITTED", "LATE"],
  SUBMITTED: ["GRADED", "REVISION_REQUIRED"],
  LATE: ["GRADED", "REVISION_REQUIRED"],
  REVISION_REQUIRED: ["RESUBMITTED", "DRAFT"],
  RESUBMITTED: ["GRADED", "REVISION_REQUIRED"],
  GRADED: [],
};

export function assertTransition(from: string, to: string): void {
  const allowed = TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new Error(`TRANSITION_INVALID: ${from} -> ${to} tidak diizinkan`);
  }
}
