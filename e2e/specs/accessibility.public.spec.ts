import type { Page } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow } from "../support/axe.ts";
import { expect, test } from "../support/fixtures.ts";
import { entryUrl, rootUrl, searchUrl } from "../support/urls.ts";

const settled = async (page: Page): Promise<void> => {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Login" }).or(page.getByRole("button", { name: "Logout" })),
  ).toBeVisible();
};

test.describe("axe on public pages", () => {
  const pages: [string, string][] = [
    ["home", "/"],
    ["Arabic entry with a conjugation table", entryUrl("كتب")],
    ["English entry with translations", entryUrl("book")],
    ["entry shared by two headwords", entryUrl("كتاب")],
    ["Form VIII entry", entryUrl("اصطبر")],
    ["login", "/auth/login"],
    ["search results", searchUrl("كتب")],
    ["empty search", "/search"],
    ["search without matches", searchUrl("qqqqzzzz")],
    ["Arabic list", "/lang/ar"],
    ["English list", "/lang/en"],
    ["root", rootUrl("كتب")],
    ["verb forms", "/arabic-verb-form"],
    ["verb form VIII", "/arabic-verb-form/8"],
    ["appendix", "/appendix/arabic-verbs"],
    ["not found", "/entry/no-such-entry"],
  ];

  for (const [name, path] of pages) {
    test(`${name} has no axe violations`, async ({ page }) => {
      await page.goto(path);
      await settled(page);
      await expectNoAxeViolations(page);
    });
  }

  test("the search suggestions open without axe violations", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Search Dictionary" }).click();
    await page.getByRole("combobox", { name: "Search Dictionary" }).pressSequentially("كتب");
    await expect(page.getByRole("listbox", { name: "Search suggestions" })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expectNoAxeViolations(page);
  });

  test("the login form with an error has no axe violations", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Password").fill("wrong-password-value");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.locator("#password-error")).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe("the accessibility helpers", () => {
  test("axe reports a violation that is injected into a page", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    await page.evaluate(() => {
      const button = document.createElement("button");
      const image = document.createElement("img");
      image.src = "/favicon-16x16.png";
      document.querySelector("main")?.append(button, image);
    });
    await expect(expectNoAxeViolations(page)).rejects.toThrow();
  });

  test("the overflow check reports a page that is wider than the screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await settled(page);
    await page.evaluate(() => {
      const wide = document.createElement("div");
      wide.style.width = "900px";
      wide.style.height = "10px";
      document.body.append(wide);
    });
    await expect(expectNoHorizontalOverflow(page)).rejects.toThrow();
  });
});

test.describe("axe on admin pages", () => {
  test("dashboard", async ({ adminPage }) => {
    await adminPage.goto("/admin");
    await settled(adminPage);
    await expectNoAxeViolations(adminPage);
  });

  test("entries list", async ({ adminPage }) => {
    await adminPage.goto("/admin/entries");
    await settled(adminPage);
    await expectNoAxeViolations(adminPage);
  });

  test("entries list with the delete dialog open", async ({ adminPage }) => {
    await adminPage.goto("/admin/entries");
    await adminPage.getByRole("checkbox", { name: "Select book" }).check();
    await adminPage.getByRole("button", { name: /Delete Selected/ }).click();
    await expect(adminPage.getByRole("alertdialog")).toBeVisible();
    await expectNoAxeViolations(adminPage);
  });

  test("entry preview", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/entries/${seed.entries.kataba}`);
    await settled(adminPage);
    await expectNoAxeViolations(adminPage);
  });

  test("edit entry", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/edit-entry/${seed.entries.book}`);
    await expect(adminPage.getByRole("heading", { level: 1, name: "Edit Entry" })).toBeVisible();
    await expect(adminPage.getByText("Translation 2")).toBeVisible();
    await expectNoAxeViolations(adminPage);
  });

  test("edit Arabic verb entry with the verb form and override fields", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/edit-entry/${seed.entries.kataba}`);
    await expect(adminPage.getByLabel("Verb form")).toBeVisible();
    await expectNoAxeViolations(adminPage);
  });

  test("new entry", async ({ adminPage }) => {
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByRole("button", { name: "+", exact: true }).click();
    await adminPage.getByRole("button", { name: "+ Add Translation" }).click();
    await adminPage.getByRole("button", { name: "+ Add Relation" }).click();
    await expectNoAxeViolations(adminPage);
  });

  test("patterns list", async ({ adminPage }) => {
    await adminPage.goto("/admin/morph-patterns");
    await settled(adminPage);
    await expectNoAxeViolations(adminPage);
  });

  test("pattern detail with its preview", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/morph-patterns/${seed.patterns.inUse}`);
    await adminPage.getByRole("button", { name: "Generate preview" }).click();
    await expect(adminPage.getByText("Masdar:")).toBeVisible();
    await expectNoAxeViolations(adminPage);
  });

  test("pattern edit", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/morph-patterns/${seed.patterns.editor}/edit`);
    await expect(adminPage.locator("#rules-masdar")).toBeVisible();
    await expectNoAxeViolations(adminPage);
  });

  test("new pattern", async ({ adminPage }) => {
    await adminPage.goto("/admin/morph-patterns/new");
    await expect(adminPage.locator("#rules-masdar")).toBeVisible();
    await expectNoAxeViolations(adminPage);
  });

  test("new override", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/morph-patterns/${seed.patterns.editor}/overrides/new`);
    await settled(adminPage);
    await expectNoAxeViolations(adminPage);
  });

  test("delete entry", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/delete-entry/${seed.entries.draft}`);
    await settled(adminPage);
    await expectNoAxeViolations(adminPage);
  });
});

test.describe("a 375 pixel wide screen", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  const pages: [string, string][] = [
    ["home", "/"],
    ["Arabic entry with a conjugation table", entryUrl("كتب")],
    ["English entry", entryUrl("book")],
    ["Form VIII entry", entryUrl("اصطبر")],
    ["search results", searchUrl("كتب")],
    ["login", "/auth/login"],
    ["Arabic list", "/lang/ar"],
    ["appendix", "/appendix/arabic-verbs"],
  ];

  for (const [name, path] of pages) {
    test(`${name} fits the width without horizontal scrolling`, async ({ page }) => {
      await page.goto(path);
      await settled(page);
      await expectNoHorizontalOverflow(page);
    });
  }

  test("home has no axe violations", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    await expectNoAxeViolations(page);
  });

  test("an Arabic entry has no axe violations", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    await settled(page);
    await expectNoAxeViolations(page);
  });

  test("an English entry has no axe violations", async ({ page }) => {
    await page.goto(entryUrl("book"));
    await settled(page);
    await expectNoAxeViolations(page);
  });

  test("the conjugation table scrolls inside its own region instead of the page", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    const region = page.getByRole("region", { name: /Active voice conjugation of/ });
    await expect(region).toBeVisible();
    const metrics = await region.evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    expect(metrics.scroll).toBeGreaterThan(metrics.client);
    await expectNoHorizontalOverflow(page);
  });

  test("admin lists fit the width", async ({ adminPage }) => {
    for (const path of ["/admin", "/admin/entries", "/admin/morph-patterns"]) {
      await adminPage.goto(path);
      await settled(adminPage);
      await expectNoHorizontalOverflow(adminPage);
    }
  });
});
