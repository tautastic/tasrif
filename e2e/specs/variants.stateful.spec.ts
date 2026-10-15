import type { Page } from "@playwright/test";
import { removeEntries } from "../support/entries.ts";
import { expect, test } from "../support/fixtures.ts";
import { alerts } from "../support/ui.ts";

const ROOT = "جوب";
const RESPOND = "اِسْتَجَابَ";
const INTERROGATE = "اِسْتَجْوَبَ";
const STRONG_CODE = "f10-hollow-strong-inflection";
const HOLLOW_CODE = "f10-hollow-waw";

const patternId = async (db: import("../../tests/harness/client.ts").Db, code: string): Promise<number> =>
  db.scalar<number>("SELECT id FROM morph_pattern WHERE code = $1", [code]);

const storedPattern = (db: import("../../tests/harness/client.ts").Db, text: string): Promise<number | null> =>
  db.scalar<number | null>("SELECT morph_pattern_id FROM lexical_entry WHERE text = $1", [text]);

const startVerb = async (page: Page, text: string, root: string): Promise<void> => {
  await page.goto("/admin/new-entry");
  await page.getByLabel("Language").selectOption("ar");
  await page.getByLabel("Text", { exact: true }).fill(text);
  await page.getByLabel("Root (Arabic)").fill(root);
  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByLabel("Part of Speech").selectOption("verb");
  await page.getByLabel("Definitions (one per line)").fill(`definition of ${text}`);
  await page.getByLabel("Verb form").selectOption("form-10");
};

test.describe("verb variants in the entry form", () => {
  test("a root with two verbs of one form offers both, and the chosen one is stored", async ({ adminPage, db }) => {
    const hollow = await patternId(db, HOLLOW_CODE);
    const strong = await patternId(db, STRONG_CODE);
    await removeEntries(db, `e2e ${INTERROGATE}`, `e2e ${RESPOND}`);

    await startVerb(adminPage, `e2e ${INTERROGATE}`, ROOT);
    const select = adminPage.getByLabel("Verb variant");
    await expect(select).toBeVisible();
    await expect(select.locator("option")).toHaveCount(2);
    await expect(select.locator("option").first()).toContainText(RESPOND);
    await expect(select.locator("option").first()).toContainText("Default");
    await expect(select.locator("option").nth(1)).toContainText(INTERROGATE);
    await expect(select.locator("option").nth(1)).toContainText("interrogate");
    await expect(select).toHaveValue(String(hollow));
    await select.selectOption(String(strong));
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/admin\/entries\/\d+$/);
    expect(await storedPattern(db, `e2e ${INTERROGATE}`)).toBe(strong);
    await expect(adminPage.getByRole("region", { name: /Active voice conjugation of/ })).toContainText(INTERROGATE);

    await startVerb(adminPage, `e2e ${RESPOND}`, ROOT);
    await expect(adminPage.getByLabel("Verb variant")).toHaveValue(String(hollow));
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/admin\/entries\/\d+$/);
    expect(await storedPattern(db, `e2e ${RESPOND}`)).toBe(hollow);
    const region = adminPage.getByRole("region", { name: /Active voice conjugation of/ });
    await expect(region).toContainText(RESPOND);
    await expect(region).not.toContainText(INTERROGATE);

    await removeEntries(db, `e2e ${INTERROGATE}`, `e2e ${RESPOND}`);
  });

  test("a root with one verb shows no variant choice", async ({ adminPage }) => {
    await startVerb(adminPage, "e2e single verb", "كتب");
    await expect(adminPage.getByText(/pattern found/)).toBeVisible();
    await expect(adminPage.getByLabel("Verb variant")).toHaveCount(0);
  });

  test("editing keeps the variant of an entry, and the default can be chosen again", async ({ adminPage, db }) => {
    const hollow = await patternId(db, HOLLOW_CODE);
    const strong = await patternId(db, STRONG_CODE);
    await removeEntries(db, `e2e keep ${INTERROGATE}`);
    const entryId = await db.scalar<number>(
      `INSERT INTO lexical_entry (language, text, root, morph_pattern_id, is_verified)
       VALUES ('ar', $1, $2, $3, TRUE) RETURNING id`,
      [`e2e keep ${INTERROGATE}`, ROOT, strong],
    );
    await db.exec(
      "INSERT INTO sense (lexical_entry_id, pos, sense_number, definitions) VALUES ($1, 'verb', 1, ARRAY['kept'])",
      [entryId],
    );

    await adminPage.goto(`/admin/edit-entry/${entryId}`);
    const select = adminPage.getByLabel("Verb variant");
    await expect(select).toHaveValue(String(strong));
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    expect(await storedPattern(db, `e2e keep ${INTERROGATE}`)).toBe(strong);

    await adminPage.goto(`/admin/edit-entry/${entryId}`);
    await expect(select).toHaveValue(String(strong));
    await select.selectOption(String(hollow));
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    expect(await storedPattern(db, `e2e keep ${INTERROGATE}`)).toBe(hollow);

    await adminPage.goto(`/admin/edit-entry/${entryId}`);
    await expect(select).toHaveValue(String(hollow));
    await removeEntries(db, `e2e keep ${INTERROGATE}`);
  });

  test("changing the root removes the variant choice instead of carrying it over", async ({ adminPage, db }) => {
    await startVerb(adminPage, "e2e moving root", ROOT);
    await expect(adminPage.getByLabel("Verb variant")).toBeVisible();
    await adminPage.getByLabel("Root (Arabic)").fill("كتب");
    await expect(adminPage.getByLabel("Verb variant")).toHaveCount(0);
    await adminPage.getByLabel("Root (Arabic)").fill(ROOT);
    await expect(adminPage.getByLabel("Verb variant")).toHaveValue(String(await patternId(db, HOLLOW_CODE)));
  });
});

test.describe("variants in the pattern override admin", () => {
  test("a variant override is added, shown, offered in the entry form and deleted again", async ({ adminPage, db }) => {
    const strong = await patternId(db, STRONG_CODE);
    const hollow = await patternId(db, HOLLOW_CODE);
    const root = "ضوف";
    await db.exec("DELETE FROM lexical_pattern_override WHERE root = $1", [root]);

    await adminPage.goto(`/admin/morph-patterns/${strong}`);
    const table = adminPage.getByRole("table");
    await expect(table.getByRole("columnheader", { name: "Variant" })).toBeVisible();
    await expect(table.getByRole("row", { name: new RegExp(`${ROOT}.*interrogate`) })).toBeVisible();

    await adminPage.getByRole("link", { name: "Add override" }).click();
    await expect(adminPage).toHaveURL(/\/overrides\/new$/);
    await adminPage.getByLabel("Root (Arabic)").fill(root);
    await expect(adminPage.getByLabel("Variant (optional)")).toHaveValue("");
    await adminPage.getByLabel("Variant (optional)").fill("e2e-strong");
    await adminPage.getByRole("button", { name: "Add Override" }).click();
    await expect(adminPage).toHaveURL(new RegExp(`/admin/morph-patterns/${strong}$`));
    await expect(table.getByRole("row", { name: new RegExp(`${root}.*e2e-strong`) })).toBeVisible();
    expect(
      await db.scalar<string>("SELECT variant FROM lexical_pattern_override WHERE root = $1 AND form_number = 10", [
        root,
      ]),
    ).toBe("e2e-strong");

    await startVerb(adminPage, "e2e ضَافَ", root);
    const select = adminPage.getByLabel("Verb variant");
    await expect(select.locator("option")).toHaveCount(2);
    await expect(select.locator("option").nth(1)).toContainText("e2e-strong");
    await expect(select).toHaveValue(String(hollow));

    await adminPage.goto(`/admin/morph-patterns/${strong}`);
    await table
      .getByRole("row", { name: new RegExp(`${root}.*e2e-strong`) })
      .getByRole("link", { name: "Delete" })
      .click();
    await expect(adminPage.getByText("variant e2e-strong")).toBeVisible();
    await adminPage.getByRole("button", { name: /delete/i }).click();
    await expect(adminPage).toHaveURL(new RegExp(`/admin/morph-patterns/${strong}$`));
    expect(await db.scalar<number>("SELECT count(*)::int FROM lexical_pattern_override WHERE root = $1", [root])).toBe(
      0,
    );
  });

  test("a variant name that is not a slug and a duplicate variant are explained and not saved", async ({
    adminPage,
    db,
  }) => {
    const strong = await patternId(db, STRONG_CODE);
    const before = await db.scalar<number>("SELECT count(*)::int FROM lexical_pattern_override");

    await adminPage.goto(`/admin/morph-patterns/${strong}/overrides/new`);
    await adminPage.getByLabel("Root (Arabic)").fill("ضوف");
    await adminPage.getByLabel("Variant (optional)").fill("Not A Slug");
    await adminPage.getByLabel("Variant (optional)").blur();
    await expect(adminPage.locator("#variant-error")).toContainText("lower-case name");
    await adminPage.getByRole("button", { name: "Add Override" }).click();
    await expect(adminPage.locator("#variant")).toBeFocused();

    await adminPage.getByLabel("Root (Arabic)").fill(ROOT);
    await adminPage.getByLabel("Variant (optional)").fill("interrogate");
    await expect(adminPage.locator("#variant-error")).toHaveCount(0);
    await adminPage.getByRole("button", { name: "Add Override" }).click();
    await expect(alerts(adminPage)).toHaveText(
      "An override for this root, form number, vowels and variant already exists",
    );
    expect(await db.scalar<number>("SELECT count(*)::int FROM lexical_pattern_override")).toBe(before);
  });

  test("a variant has to point to a lexical pattern", async ({ adminPage, db }) => {
    const hollow = await patternId(db, HOLLOW_CODE);
    await adminPage.goto(`/admin/morph-patterns/${hollow}/overrides/new`);
    await adminPage.getByLabel("Root (Arabic)").fill("ضوف");
    await adminPage.getByLabel("Variant (optional)").fill("plain");
    await adminPage.getByRole("button", { name: "Add Override" }).click();
    await expect(alerts(adminPage)).toHaveText(
      "A variant has to point to a lexical pattern, one that describes a single verb",
    );
  });
});
