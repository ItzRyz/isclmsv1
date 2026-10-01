import { expect, test } from "@playwright/test";
import { emails, getUserId } from "./fixtures";
import { badge, cardTitle, login } from "./helpers";

test.describe.serial("role management E2E", () => {
  let targetId: string;

  test("admin memberi peran MENTOR ke target", async ({ page }) => {
    targetId = await getUserId(emails.target);
    await login(page, emails.admin);
    await page.goto(`/admin/users/${targetId}`);
    await expect(cardTitle(page, "Peran")).toBeVisible();

    await page
      .locator('select[name="role_id"]')
      .selectOption({ label: "MENTOR" });
    await page.getByRole("button", { name: "Beri" }).click();
    await expect(badge(page, /^MENTOR$/)).toBeVisible({ timeout: 15_000 });
  });

  test("audit log mencatat role.assign", async ({ page }) => {
    await login(page, emails.admin);
    await page.goto("/admin/audit");
    await expect(
      page.getByRole("heading", { name: "Audit log (read-only)" }),
    ).toBeVisible();

    await page.locator('input[name="action"]').fill("role.assign");
    await page.getByRole("button", { name: "Filter" }).click();
    const row = page.locator("details").filter({ hasText: "role.assign" });
    await expect(row.first()).toBeVisible();
    await expect(row.first()).toContainText("user_roles");
  });

  test("admin mencabut peran MENTOR", async ({ page }) => {
    await login(page, emails.admin);
    await page.goto(`/admin/users/${targetId}`);
    await page.getByRole("button", { name: "Cabut" }).click();
    await expect(badge(page, /^MENTOR$/)).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test("member ditolak dari manajemen user", async ({ page }) => {
    await login(page, emails.member);
    await page.goto("/admin/users");
    await expect(page.getByText("Akses ditolak")).toBeVisible();
    await expect(page.getByText("Butuh permission user.view.")).toBeVisible();
  });
});
