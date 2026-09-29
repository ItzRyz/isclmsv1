import { seededShuffle } from "./shuffle";

/** Batas waktu attempt (null = tanpa batas). */
export function attemptDeadline(
  startedAt: string,
  timeLimitSeconds: number | null,
): number | null {
  if (!timeLimitSeconds) return null;
  return new Date(startedAt).getTime() + timeLimitSeconds * 1000;
}

/** Urutan soal tampil (acak deterministik bila flag menyala). */
export function orderQuestions<T extends { id: string }>(
  questions: T[],
  attemptId: string,
  shuffle: boolean,
): T[] {
  return shuffle ? seededShuffle(questions, `q:${attemptId}`) : questions;
}

/** Urutan opsi tampil (acak deterministik bila flag menyala). */
export function orderOptions<T extends { id: string }>(
  options: T[],
  attemptId: string,
  questionId: string,
  shuffle: boolean,
): T[] {
  return shuffle
    ? seededShuffle(options, `o:${attemptId}:${questionId}`)
    : options;
}
