import { expect, type Page } from "@playwright/test";
import { PASSWORD } from "./fixtures";

/** Login via UI /login (menguji form + sesi cookie). */
export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Keluar" }).click();
  await page.waitForURL("**/login");
}

/** Badge dengan teks persis (data-slot="badge" dari shadcn). */
export function badge(page: Page, text: string | RegExp) {
  return page.locator('[data-slot="badge"]').filter({ hasText: text }).first();
}

/** Judul card (shadcn CardTitle = div, bukan element heading). */
export function cardTitle(page: Page, text: string | RegExp) {
  return page
    .locator('[data-slot="card-title"]')
    .filter({ hasText: text })
    .first();
}

export async function expectNotFound(page: Page): Promise<void> {
  await expect(page.getByText("404 — Tidak ditemukan")).toBeVisible();
}
