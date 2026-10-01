import { expect, test } from "@playwright/test";
import { emails, getMaterialId } from "./fixtures";
import { expectNotFound, login } from "./helpers";

test.describe("learning E2E", () => {
  test("member: course → materi → prasyarat → progres", async ({ page }) => {
    await login(page, emails.member);

    await page.goto("/learning");
    await expect(
      page.getByRole("heading", { name: "Pembelajaran" }),
    ).toBeVisible();
    // Form buat course hanya untuk staf.
    await expect(page.getByRole("button", { name: "Buat course" })).toHaveCount(
      0,
    );

    await page.getByRole("link", { name: /E2E Course/ }).click();
    await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}/);
    await expect(page.getByText(/Progres: 0\/1 materi wajib/)).toBeVisible();

    // Materi B terkunci selama prasyarat A belum selesai.
    await page.getByRole("link", { name: /E2E Materi B/ }).click();
    await expect(page.getByText("Terkunci 🔒")).toBeVisible();
    await expect(page.locator("article")).toHaveCount(0);

    // Selesaikan materi A.
    await page.goBack();
    await page.getByRole("link", { name: /E2E Materi A/ }).click();
    await expect(page.locator("article")).toContainText(
      "Isi materi A untuk E2E.",
    );
    await page.getByRole("button", { name: "Tandai selesai" }).click();
    await expect(page.getByRole("button", { name: /✓ Selesai/ })).toBeVisible();

    await page.goBack();
    await expect(page.getByText(/Progres: 1\/1 materi wajib/)).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();

    // Materi B kini terbuka (prasyarat terpenuhi).
    await page.getByRole("link", { name: /E2E Materi B/ }).click();
    await expect(page.getByText("Terkunci 🔒")).toHaveCount(0);
    await expect(page.locator("article")).toContainText("Materi B");
  });

  test("member: konten draf tidak terlihat (404)", async ({ page }) => {
    await login(page, emails.member);
    const draftId = await getMaterialId("e2e-materi-draft");
    await page.goto(`/materials/${draftId}`);
    await expectNotFound(page);
  });

  test("member: aktivitas belajar tercatat", async ({ page }) => {
    await login(page, emails.member);
    await page.goto("/learning/activity");
    await expect(page.getByText("Menyelesaikan materi").first()).toBeVisible();
  });
});
