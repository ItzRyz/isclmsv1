import { expect, test } from "@playwright/test";
import { emails, getComponentId, getUserId, getPeriodId } from "./fixtures";
import { badge, login } from "./helpers";

test.describe.serial("grading E2E", () => {
  let memberId: string;
  let periodId: string;

  test("admin entri nilai (normalisasi + bobot)", async ({ page }) => {
    memberId = await getUserId(emails.member);
    periodId = await getPeriodId();
    const componentId = await getComponentId("ASSIGNMENT");

    await login(page, emails.admin);
    await page.goto("/grades/entry");
    await expect(
      page.getByRole("heading", { name: "Entri nilai" }),
    ).toBeVisible();

    await page.locator('input[name="user_id"]').fill(memberId);
    await page
      .locator('select[name="academic_period_id"]')
      .selectOption(periodId);
    await page
      .locator('select[name="grade_component_id"]')
      .selectOption(componentId);
    await page.locator('input[name="raw_score"]').fill("85");
    await page.getByRole("button", { name: "Simpan nilai" }).click();

    await expect(page.getByText(/85 → 85 × 30 = 25\.5/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("member ditolak dari entri nilai", async ({ page }) => {
    await login(page, emails.member);
    await page.goto("/grades/entry");
    await expect(page.getByText("Akses ditolak")).toBeVisible();
    await expect(
      page.getByText("Butuh permission grade.create."),
    ).toBeVisible();
  });

  test("admin generate rapor → total + huruf", async ({ page }) => {
    await login(page, emails.admin);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Rapor" })).toBeVisible();

    await page.locator('input[name="user_id"]').fill(memberId);
    await page
      .locator('select[name="academic_period_id"]')
      .selectOption(periodId);
    await page.getByRole("button", { name: "Generate" }).click();

    await expect(badge(page, /\(B\)$/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/85 × 30 = 25\.5/).first()).toBeVisible();

    // Deterministik: generate ulang memberikan hasil sama.
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(badge(page, /^85 \(B\)$/)).toBeVisible({ timeout: 15_000 });
  });

  test("member melihat rapor miliknya sendiri", async ({ page }) => {
    await login(page, emails.member);
    await page.goto(`/reports?period=${periodId}`);
    await expect(page.getByText("E2E Member")).toBeVisible();
    await expect(badge(page, /^85 \(B\)$/)).toBeVisible();
    await expect(page.getByText("Generate rapor")).toHaveCount(0);
    await expect(page.getByPlaceholder("User ID")).toHaveCount(0);
  });
});
