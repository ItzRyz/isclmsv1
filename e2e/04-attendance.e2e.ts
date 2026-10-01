import { expect, test } from "@playwright/test";
import { emails, getUserId, localDateTime, runId } from "./fixtures";
import { badge, login } from "./helpers";

test.describe.serial("attendance E2E", () => {
  let sessionId: string;

  test("admin buka sesi absensi (Kelas E2E Class)", async ({ page }) => {
    await login(page, emails.admin);
    await page.goto("/attendance");
    await expect(page.getByRole("heading", { name: "Absensi" })).toBeVisible();

    await page.getByPlaceholder("Nama sesi").fill(`E2E Sesi ${runId}`);
    await page
      .locator('select[name="scope"]')
      .selectOption({ label: "Kelas: E2E Class" });
    await page
      .locator('input[name="starts_at"]')
      .fill(localDateTime(-2 * 60 * 1000));
    await page
      .locator('input[name="ends_at"]')
      .fill(localDateTime(60 * 60 * 1000));
    await page.getByRole("button", { name: "Buka sesi" }).click();

    const rowLink = page.getByRole("link", {
      name: new RegExp(`E2E Sesi ${runId}`),
    });
    await rowLink.waitFor({ state: "visible", timeout: 15_000 });
    await rowLink.click();
    await expect(page).toHaveURL(/\/attendance\/[0-9a-f-]{36}/);
    sessionId = new URL(page.url()).pathname.split("/").pop() ?? "";

    await expect(page.getByText("QR sesi (rotasi 60 dtk)")).toBeVisible();
    await expect(page.getByAltText("QR sesi absensi")).toBeVisible();
    await expect(page.getByText("Catatan (0)")).toBeVisible();
    await expect(page.getByText("Entri manual")).toBeVisible();
  });

  test("member melihat check-in mandiri (tanpa kontrol staf)", async ({
    page,
  }) => {
    await login(page, emails.member);
    await page.goto(`/attendance/${sessionId}`);
    await expect(page.getByText("Check-in mandiri")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pindai QR sesi" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Tutup sesi" })).toHaveCount(
      0,
    );
    await expect(page.getByText("Entri manual")).toHaveCount(0);
  });

  test("admin mencatat kehadiran member (entri manual)", async ({ page }) => {
    await login(page, emails.admin);
    const memberId = await getUserId(emails.member);
    await page.goto(`/attendance/${sessionId}`);

    await page.locator('input[name="user_id"]').fill(memberId);
    await page.getByRole("button", { name: "Catat manual" }).click();

    await expect(page.getByText("Catatan (1)")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("E2E Member").first()).toBeVisible();
    await expect(badge(page, /^MANUAL$/)).toBeVisible();
    await expect(badge(page, /^PRESENT: 1$/)).toBeVisible();
  });

  test("member melihat catatan kehadiran miliknya", async ({ page }) => {
    await login(page, emails.member);
    await page.goto(`/attendance/${sessionId}`);
    await expect(page.getByText("Catatan (1)")).toBeVisible();
    await expect(page.getByText("E2E Member").first()).toBeVisible();
  });

  test("admin tutup sesi → laporan tersedia", async ({ page }) => {
    await login(page, emails.admin);
    await page.goto(`/attendance/${sessionId}`);
    await page.getByRole("button", { name: "Tutup sesi" }).click();
    await expect(badge(page, /^CLOSED$/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Buka lagi" })).toBeVisible();
    await expect(page.getByText("Check-in mandiri")).toHaveCount(0);

    await page.goto("/attendance/report");
    await expect(
      page.getByRole("heading", { name: "Laporan absensi" }),
    ).toBeVisible();
    await expect(page.getByText("E2E Member").first()).toBeVisible();
    await expect(badge(page, /PRESENT:/)).toBeVisible();
  });

  test("member ditolak dari laporan absensi", async ({ page }) => {
    await login(page, emails.member);
    await page.goto("/attendance/report");
    await expect(page.getByText("Akses ditolak")).toBeVisible();
    await expect(
      page.getByText("Butuh permission attendance.view."),
    ).toBeVisible();
  });
});
