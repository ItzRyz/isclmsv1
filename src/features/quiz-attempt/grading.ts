/**
 * P1-505: penilaian server. Skor TIDAK PERNAH dari browser.
 * SINGLE/TRUE_FALSE: cocok persis = poin penuh.
 * MULTIPLE: himpunan terpilih harus sama persis dengan kunci.
 */
export type GradeInput = {
  questionId: string;
  questionType: string;
  points: number;
  correctOptionIds: string[];
  selectedOptionIds: string[];
};

export type GradeResult = {
  total: number;
  perQuestion: { questionId: string; correct: boolean; awarded: number }[];
};

export function gradeAnswers(questions: GradeInput[]): GradeResult {
  let total = 0;
  const perQuestion = questions.map((q) => {
    const correct = new Set(q.correctOptionIds);
    const selected = new Set(q.selectedOptionIds);
    const same =
      correct.size === selected.size &&
      [...correct].every((id) => selected.has(id));
    const awarded = same ? q.points : 0;
    total += awarded;
    return { questionId: q.questionId, correct: same, awarded };
  });
  return { total, perQuestion };
}

export function isPass(score: number, passingScore: number | null): boolean {
  if (passingScore === null) return true;
  return score >= passingScore;
}
