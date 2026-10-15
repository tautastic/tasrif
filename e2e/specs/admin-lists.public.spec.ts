import { WORDS } from "../support/data.ts";
import { expect, test } from "../support/fixtures.ts";

test.describe("needs attention", () => {
  test("an entry with a pattern and a broken root is counted on the dashboard", async ({ adminPage }) => {
    await adminPage.goto("/admin");
    const card = adminPage.getByRole("link", { name: /Needs attention/ });
    await expect(card).toContainText("Needs attention (1)");
    await expect(card).toContainText("1 entry has a pattern but no derived forms. Check the root.");
    await expect(card).toHaveAttribute("href", "/admin/entries?filter=Needs+attention");
  });

  test("the needs attention filter lists exactly the entry with the broken root", async ({ adminPage }) => {
    await adminPage.goto("/admin");
    await adminPage.getByRole("link", { name: /Needs attention/ }).click();
    await expect(adminPage).toHaveURL(/filter=Needs\+attention/);
    const rows = adminPage.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(WORDS.broken.text);
    await expect(adminPage.getByLabel("Filter entries by status")).toHaveValue("Needs attention");
  });

  test("the other filters separate verified from unverified entries", async ({ adminPage }) => {
    await adminPage.goto("/admin/entries");
    const filter = adminPage.getByLabel("Filter entries by status");
    await expect(filter).toHaveValue("All");
    await filter.selectOption("Unverified");
    await expect(adminPage).toHaveURL(/filter=Unverified/);
    await expect(adminPage.locator("tbody tr")).toHaveCount(1);
    await expect(adminPage.locator("tbody tr").first()).toContainText(WORDS.draft.text);
    await expect(adminPage.locator("tbody tr").first()).toContainText("Unverified");

    await filter.selectOption("Verified");
    await expect(adminPage).toHaveURL(/filter=Verified/);
    await expect(adminPage.locator("tbody tr").filter({ hasText: WORDS.draft.text })).toHaveCount(0);
    await expect(adminPage.locator("tbody tr").filter({ hasText: WORDS.kataba.text })).toHaveCount(1);
  });

  test("the unverified draft can be previewed in the admin area although it has no public page", async ({
    adminPage,
    seed,
  }) => {
    await adminPage.goto(`/admin/entries/${seed.entries.draft}`);
    await expect(adminPage.getByRole("heading", { level: 1 })).toHaveText(WORDS.draft.text);
    await expect(adminPage.getByText("Unverified", { exact: true })).toBeVisible();
  });
});

test.describe("admin lists", () => {
  test("each row of the entries table has a unique accessible selection label", async ({ adminPage }) => {
    await adminPage.goto("/admin/entries");
    const labels = await adminPage
      .locator("tbody input[type=checkbox]")
      .evaluateAll((boxes) => boxes.map((box) => box.getAttribute("aria-label")));
    expect(labels.length).toBeGreaterThan(10);
    expect(labels.every((label) => label?.startsWith("Select ") && label.length > "Select ".length)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
    await expect(adminPage.getByRole("columnheader")).toHaveText([
      "",
      "Text",
      "Root",
      "Senses",
      "Form",
      "Status",
      "Actions",
    ]);
  });

  test("the patterns table lists the seeded patterns with unique selection labels", async ({ adminPage }) => {
    await adminPage.goto("/admin/morph-patterns");
    const labels = await adminPage
      .locator("tbody input[type=checkbox]")
      .evaluateAll((boxes) => boxes.map((box) => box.getAttribute("aria-label")));
    expect(labels.length).toBeGreaterThan(20);
    expect(new Set(labels).size).toBe(labels.length);
    await expect(adminPage.getByRole("checkbox", { name: "Select I a ~ u", exact: true })).toBeVisible();
  });

  test("the dashboard links reach the entries, patterns and new entry pages", async ({ adminPage }) => {
    await adminPage.goto("/admin");
    await expect(adminPage.getByRole("heading", { level: 1, name: "Admin Dashboard" })).toBeVisible();
    await adminPage.getByRole("link", { name: /^Patterns/ }).click();
    await expect(adminPage.getByRole("heading", { level: 1, name: "Morphological Patterns" })).toBeVisible();
    await adminPage.goto("/admin");
    await adminPage.getByRole("link", { name: /^Add Entry/ }).click();
    await expect(adminPage.getByRole("heading", { level: 1, name: "Add Entry" })).toBeVisible();
  });

  test("an admin entry page that does not exist is a 404 and a malformed id too", async ({ adminPage }) => {
    for (const path of [
      "/admin/entries/999999",
      "/admin/entries/abc",
      "/admin/edit-entry/0",
      "/admin/delete-entry/-1",
    ]) {
      const response = await adminPage.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });
});
