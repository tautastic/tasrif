import type { Page } from "@playwright/test";
import { ADMIN_PASSWORD } from "../support/constants.ts";
import { expect, test } from "../support/fixtures.ts";
import { signInThroughForm } from "../support/session.ts";
import { entryUrl } from "../support/urls.ts";

test.describe("signing in from the browser", () => {
  test("logging in shows the Admin link and Logout immediately, without a reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Site" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: "Login" }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await page.evaluate(() => {
      Reflect.set(window, "__e2eNoReload", true);
    });
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Login" })).toHaveCount(0);
    expect(await page.evaluate(() => Reflect.get(window, "__e2eNoReload"))).toBe(true);
  });

  test("logging out removes the Admin link and shows Login again", async ({ adminPage }) => {
    await adminPage.goto("/");
    await expect(adminPage.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
    await adminPage.getByRole("button", { name: "Logout" }).click();
    await expect(adminPage).toHaveURL(/\/auth\/login$/);
    await adminPage.goto("/");
    await expect(adminPage.getByRole("link", { name: "Login" })).toBeVisible();
    await expect(adminPage.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  });

  test("a safe next path is honoured after login", async ({ page }) => {
    await signInThroughForm(page, "/admin/entries");
    await expect(page).toHaveURL(/\/admin\/entries$/);
    await expect(page.getByRole("heading", { level: 1, name: "Entries" })).toBeVisible();
  });

  test("a safe next path with a query string is kept", async ({ page }) => {
    await signInThroughForm(page, "/admin/entries?filter=Unverified");
    await expect(page).toHaveURL(/\/admin\/entries\?filter=Unverified$/);
  });

  for (const unsafe of [
    "//evil.example/phish",
    "/\\evil.example",
    "https://evil.example/phish",
    "javascript:alert(1)",
    "/admin\\..\\evil",
  ]) {
    test(`an unsafe next of ${unsafe} lands on the home page`, async ({ page }) => {
      await signInThroughForm(page, unsafe);
      await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
      const landed = new URL(page.url());
      expect(landed.hostname).toBe("127.0.0.1");
      expect(landed.pathname).toBe("/");
    });
  }

  test("visiting an admin page while logged out sends the visitor to login and back", async ({ page }) => {
    await page.goto("/admin/morph-patterns");
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fadmin%2Fmorph-patterns$/);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(/\/admin\/morph-patterns$/);
    await expect(page.getByRole("heading", { level: 1, name: "Morphological Patterns" })).toBeVisible();
  });
});

test.describe("auth status requests", () => {
  const countStatusRequests = (page: Page): string[] => {
    const seen: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/auth/status") {
        seen.push(request.url());
      }
    });
    return seen;
  };

  test("an anonymous page load asks for the auth status once, also across client navigation", async ({ page }) => {
    const seen = countStatusRequests(page);
    await page.goto(entryUrl("book"));
    await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
    expect(seen).toHaveLength(1);

    await page.getByRole("link", { name: "Tasrif" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: "English entries" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "English Entries" })).toBeVisible();
    expect(seen).toHaveLength(1);
  });

  test("an admin page load asks for the auth status once", async ({ adminPage }) => {
    const seen = countStatusRequests(adminPage);
    await adminPage.goto(entryUrl("book"));
    await expect(adminPage.getByRole("button", { name: "Logout" })).toBeVisible();
    await expect(adminPage.getByRole("link", { name: "Edit" })).toBeVisible();
    expect(seen).toHaveLength(1);
  });
});
