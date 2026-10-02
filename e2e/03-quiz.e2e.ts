import { expect, test } from "@playwright/test";
import { emails, getCourseId, getQuestionId, runId } from "./fixtures";
import { badge, login } from "./helpers";

test.describe.serial("quiz E2E", () => {
  let quizId: string;
  let questionId: string;

  test("admin membuat soal di bank", async ({ page }) => {
    await login(page, emails.admin);
    await page.goto("/quizzes/bank");
    await expect(
      page.getByRole("heading", { name: /Bank soal/ }),
    ).toBeVisible();

    await page
      .getByPlaceholder("Tulis soal…")
      .fill(`E2E Berapa hasil 1+1? ${runId}`);
    await page.getByPlaceholder("Opsi 1 (wajib)").fill("Dua");
    await page.getByPlaceholder("Opsi 2 (wajib)").fill("Tiga");
    await page.locator('input[name="correct_0"]').check();
    await page.getByRole("button", { name: "Simpan soal" }).click();

    await expect(page.getByText(/E2E Berapa hasil 1\+1\?/).first()).toBeVisible(
      {
        timeout: 15_000,
      },
    );
    questionId = await getQuestionId(`E2E Berapa hasil 1+1? ${runId}`);
  });

  test("admin membuat kuis, menambah soal, publish", async ({ page }) => {
    await login(page, emails.admin);
    const courseId = await getCourseId();
    await page.goto(`/courses/${courseId}`);

    await page.getByPlaceholder("Judul kuis").fill(`E2E Kuis ${runId}`);
    await page.locator('input[name="max_attempts"]').fill("2");
    await page.getByRole("button", { name: "Buat kuis (DRAFT)" }).click();

    const rowLink = page.getByRole("link", {
      name: new RegExp(`E2E Kuis ${runId}`),
    });
    await rowLink.waitFor({ state: "visible", timeout: 15_000 });
    await rowLink.click();
    await expect(page).toHaveURL(/\/quizzes\/[0-9a-f-]{36}/);
    quizId = new URL(page.url()).pathname.split("/").pop() ?? "";

    await page.locator('select[name="question_id"]').selectOption(questionId);
    await page.getByRole("button", { name: "Tambah", exact: true }).click();
    await expect(page.getByText("Soal (1)")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(badge(page, /^PUBLISHED$/)).toBeVisible();
  });

  test("member mengerjakan kuis sampai nilai", async ({ page }) => {
    await login(page, emails.member);
    await page.goto(`/quizzes/${quizId}`);

    await expect(page.getByText("Pengerjaan")).toBeVisible();
    await expect(page.getByText("Maks 2x coba")).toBeVisible();
    await page.getByRole("button", { name: "Mulai attempt #1" }).click();

    await expect(page.getByText("Jawaban tersimpan otomatis")).toBeVisible();
    await expect(page.getByText("Tanpa batas waktu").first()).toBeVisible();
    await page.getByLabel(/^Dua$/).check();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Kumpulkan jawaban" }).click();

    // Submit memicu re-render: runner unmount, riwayat muncul.
    await expect(page.getByText("Attempt #1")).toBeVisible({
      timeout: 15_000,
    });
    await expect(badge(page, /^SUBMITTED$/)).toBeVisible();
    await page.getByRole("button", { name: "Hitung nilai" }).click();
    await expect(badge(page, /^Nilai 1$/)).toBeVisible({ timeout: 15_000 });
  });

  test("member: kuota attempt habis setelah batas tercapai", async ({
    page,
  }) => {
    await login(page, emails.member);
    await page.goto(`/quizzes/${quizId}`);
    await page.getByRole("button", { name: "Mulai attempt #2" }).click();
    await expect(page.getByText("Jawaban tersimpan otomatis")).toBeVisible();
    await page.getByRole("button", { name: "Kumpulkan jawaban" }).click();
    await expect(page.getByText("Attempt #2")).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText("Kuota attempt habis.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Mulai attempt/ }),
    ).toHaveCount(0);
  });
});
