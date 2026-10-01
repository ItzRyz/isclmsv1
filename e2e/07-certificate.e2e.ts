import { expect, test } from "@playwright/test";
import { emails, getCertificateToken, getUserId, runId } from "./fixtures";
import { badge, login } from "./helpers";

test.describe.serial("certificate verification E2E", () => {
  let memberId: string;
  let token: string;

  test("admin menerbitkan sertifikat", async ({ page }) => {
    memberId = await getUserId(emails.member);
    const program = `E2E Program ${runId}`;

    await login(page, emails.admin);
    await page.goto("/certificates");
    await expect(page.getByText("Terbitkan sertifikat")).toBeVisible();

    await page.locator('input[name="user_id"]').fill(memberId);
    await page.getByPlaceholder("Nama program").fill(program);
    await page.getByPlaceholder("Nama penerbit").fill("E2E Penerbit");
    await page.getByRole("button", { name: "Terbitkan" }).click();

    await expect(page.getByText(program).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(badge(page, /^SC-\d{4}-[0-9A-F]{6}$/).first()).toBeVisible();

    token = await getCertificateToken(memberId);
    expect(token).toHaveLength(64);
  });

  test("publik: token valid terverifikasi", async ({ page }) => {
    await page.goto(`/verify/${token}`);
    await expect(page.getByText("Terverifikasi ✓")).toBeVisible();
    await expect(page.getByText("E2E Member")).toBeVisible();
    await expect(page.getByText(`E2E Program ${runId}`)).toBeVisible();
    await expect(
      page.getByText("Sertifikat Study Club yang sah."),
    ).toBeVisible();
  });

  test("publik: token tidak valid ditolak", async ({ page }) => {
    await page.goto(`/verify/${"0".repeat(64)}`);
    await expect(page.getByText("Sertifikat tidak ditemukan")).toBeVisible();
    await expect(page.getByText("Token verifikasi tidak valid.")).toBeVisible();
  });
});
