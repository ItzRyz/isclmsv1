import { expect, test } from "@playwright/test";
import { emails } from "./fixtures";
import { cardTitle, login, logout } from "./helpers";

test.describe("auth E2E", () => {
  test("anon diarahkan ke /login dengan tujuan semula", async ({ page }) => {
    await page.goto("/learning");
    await expect(page).toHaveURL(/\/login\?next=%2Flearning/);
    await expect(cardTitle(page, "Masuk")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("password salah menampilkan error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(emails.member);
    await page.getByLabel("Password").fill("Salah-Banget-1");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByText("Email atau password salah.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("login sukses lalu logout", async ({ page }) => {
    await login(page, emails.member);
    await expect(page).toHaveURL("/");
    await expect(cardTitle(page, "Study Club LMS")).toBeVisible();

    await logout(page);
    await expect(cardTitle(page, "Masuk")).toBeVisible();
    await expect(page.getByRole("link", { name: "Masuk" })).toBeVisible();
  });
});
