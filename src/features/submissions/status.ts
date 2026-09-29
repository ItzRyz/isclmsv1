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
