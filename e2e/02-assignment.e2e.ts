import { expect, test } from "@playwright/test";
import { emails, getCourseId, localDateTime, runId } from "./fixtures";
import { badge, expectNotFound, login } from "./helpers";

test.describe.serial("assignment E2E", () => {
  let assignmentId: string;

  test("admin membuat tugas (DRAFT)", async ({ page }) => {
    await login(page, emails.admin);
    const courseId = await getCourseId();
    await page.goto(`/courses/${courseId}`);

    await page.getByPlaceholder("Judul tugas").fill(`E2E Tugas ${runId}`);
    await page.getByPlaceholder("slug-tugas").fill(`e2e-tugas-${runId}`);
    await page
      .locator('input[name="due_at"]')
      .fill(localDateTime(24 * 60 * 60 * 1000));
    await page.getByRole("button", { name: "Buat tugas (DRAFT)" }).click();

    const rowLink = page.getByRole("link", {
      name: new RegExp(`E2E Tugas ${runId}`),
    });
    await rowLink.waitFor({ state: "visible", timeout: 15_000 });
    await rowLink.click();
    await expect(page).toHaveURL(/\/assignments\/[0-9a-f-]{36}/);
    assignmentId = new URL(page.url()).pathname.split("/").pop() ?? "";
    await expect(badge(page, /^DRAFT$/)).toBeVisible();
  });

  test("member: tugas DRAFT tidak terlihat (404)", async ({ page }) => {
    await login(page, emails.member);
    await page.goto(`/assignments/${assignmentId}`);
    await expectNotFound(page);
  });

  test("admin publish → Dibuka", async ({ page }) => {
    await login(page, emails.admin);
    await page.goto(`/assignments/${assignmentId}`);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(badge(page, /^PUBLISHED$/)).toBeVisible();
    await expect(badge(page, /^Dibuka$/)).toBeVisible();
  });

  test("member mengumpulkan jawaban teks", async ({ page }) => {
    await login(page, emails.member);
    await page.goto(`/assignments/${assignmentId}`);
    await expect(page.getByText("Pengumpulan saya")).toBeVisible();
    await expect(page.getByText("Belum dikumpulkan.")).toBeVisible();

    await page
      .getByPlaceholder(/Tulis jawaban/)
      .fill("Jawaban E2E untuk tugas pertama.");
    // Biarkan autosave draf terkirim sebelum submit final.
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "Kumpulkan final" }).click();

    await expect(page.getByText("Terkirim.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(badge(page, /^SUBMITTED$/)).toBeVisible();
  });

  test("admin menilai submission", async ({ page }) => {
    await login(page, emails.admin);
    await page.goto(`/assignments/${assignmentId}`);
    await page.locator('input[name="score"]').fill("95");
    await page
      .getByPlaceholder("Umpan balik untuk peserta…")
      .fill("Kerja bagus.");
    await page.getByRole("button", { name: "Simpan nilai" }).click();
    await expect(badge(page, /^Nilai 95$/)).toBeVisible({ timeout: 15_000 });
  });

  test("member melihat nilai + notifikasi", async ({ page }) => {
    await login(page, emails.member);
    await page.goto(`/assignments/${assignmentId}`);
    await expect(badge(page, /^Nilai 95$/)).toBeVisible();
    await expect(page.getByText(/Nilai: 95\/100/)).toBeVisible();

    await page.goto("/notifications");
    await expect(page.getByText("Nilai keluar: 95/100").first()).toBeVisible();
  });
});
