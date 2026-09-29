import { describe, expect, test } from "bun:test";
import { gradeAnswers, isPass } from "./grading";

describe("gradeAnswers", () => {
  test("single cocok persis = penuh", () => {
    const r = gradeAnswers([
      {
        questionId: "q1",
        questionType: "SINGLE_CHOICE",
        points: 10,
        correctOptionIds: ["a"],
        selectedOptionIds: ["a"],
      },
    ]);
    expect(r.total).toBe(10);
    expect(r.perQuestion[0]?.correct).toBe(true);
  });

  test("single salah = 0 (tanpa pengurangan)", () => {
    const r = gradeAnswers([
      {
        questionId: "q1",
        questionType: "SINGLE_CHOICE",
        points: 10,
        correctOptionIds: ["a"],
        selectedOptionIds: ["b"],
      },
    ]);
    expect(r.total).toBe(0);
  });

  test("multiple harus sama persis (parsial = 0)", () => {
    const base = {
      questionId: "q1",
      questionType: "MULTIPLE_CHOICE",
      points: 10,
      correctOptionIds: ["a", "b"],
    };
    expect(
      gradeAnswers([{ ...base, selectedOptionIds: ["a", "b"] }]).total,
    ).toBe(10);
    expect(gradeAnswers([{ ...base, selectedOptionIds: ["a"] }]).total).toBe(0);
    expect(
      gradeAnswers([{ ...base, selectedOptionIds: ["a", "b", "c"] }]).total,
    ).toBe(0);
  });

  test("kosong = 0", () => {
    const r = gradeAnswers([
      {
        questionId: "q1",
        questionType: "SINGLE_CHOICE",
        points: 5,
        correctOptionIds: ["a"],
        selectedOptionIds: [],
      },
    ]);
    expect(r.total).toBe(0);
  });

  test("total akumulasi", () => {
    const r = gradeAnswers([
      {
        questionId: "q1",
        questionType: "SINGLE_CHOICE",
        points: 10,
        correctOptionIds: ["a"],
        selectedOptionIds: ["a"],
      },
      {
        questionId: "q2",
        questionType: "TRUE_FALSE",
        points: 5,
        correctOptionIds: ["t"],
        selectedOptionIds: ["f"],
      },
    ]);
    expect(r.total).toBe(10);
  });
});

describe("isPass", () => {
  test("tanpa ambang = lulus", () => {
    expect(isPass(0, null)).toBe(true);
  });
  test("batas inklusif", () => {
    expect(isPass(70, 70)).toBe(true);
    expect(isPass(69.9, 70)).toBe(false);
  });
});
