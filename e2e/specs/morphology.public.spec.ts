import type { Locator, Page } from "@playwright/test";
import { FORM_I_PARTICIPLE_CASE, FORM_VIII_CASES, WORDS } from "../support/data.ts";
import { expect, test } from "../support/fixtures.ts";
import { entryUrl } from "../support/urls.ts";

const SLOT_THIRD_MASCULINE_SINGULAR = 2;
const SLOT_FIRST_SINGULAR = 0;

const nfc = (value: string): string => value.normalize("NFC");

const conjugationRegion = (page: Page): Locator => page.getByRole("region", { name: /Active voice conjugation of/ });

const perfectCell = (page: Page, slot: number): Locator =>
  conjugationRegion(page).locator("tbody tr").first().locator("td:not([aria-hidden])").nth(slot);

const principalPart = (page: Page, label: RegExp): Locator =>
  page
    .getByRole("table", { name: /^Conjugation of/ })
    .getByRole("row", { name: label })
    .getByRole("cell");

const textOf = async (locator: Locator): Promise<string> => nfc((await locator.innerText()).trim());

test.describe("Form VIII assimilation on the public entry page", () => {
  for (const formEight of FORM_VIII_CASES) {
    test(`the root ${formEight.root} shows the assimilated perfect ${formEight.perfect}`, async ({ page, seed }) => {
      await page.goto(entryUrl(seed.slugs[`form8-${formEight.root}`] ?? ""));
      await expect(page.getByText("Conjugation of")).toBeVisible();
      expect(await textOf(perfectCell(page, SLOT_THIRD_MASCULINE_SINGULAR))).toBe(nfc(formEight.perfect));
      expect(await textOf(perfectCell(page, SLOT_FIRST_SINGULAR))).toBe(nfc(`${formEight.perfect.slice(0, -1)}ْتُ`));
    });

    if (formEight.masdar && formEight.activeParticiple) {
      test(`the root ${formEight.root} shows the verbal noun and participle of the assimilated stem`, async ({
        page,
        seed,
      }) => {
        await page.goto(entryUrl(seed.slugs[`form8-${formEight.root}`] ?? ""));
        expect(await textOf(principalPart(page, /verbal noun/))).toContain(nfc(formEight.masdar ?? ""));
        expect(await textOf(principalPart(page, /active participle/))).toContain(nfc(formEight.activeParticiple ?? ""));
      });
    }
  }
});

test.describe("Form I with the vowels i and i", () => {
  test("the active participle of حسب is حَاسِب and not the adjective pattern", async ({ page }) => {
    await page.goto(entryUrl("حسب"));
    expect(await textOf(principalPart(page, /active participle/))).toContain(
      nfc(FORM_I_PARTICIPLE_CASE.activeParticiple),
    );
    expect(await textOf(principalPart(page, /active participle/))).not.toContain(nfc("أَحْسَب"));
    expect(await textOf(perfectCell(page, SLOT_THIRD_MASCULINE_SINGULAR))).toBe(nfc(FORM_I_PARTICIPLE_CASE.text));
  });
});

test.describe("Form I a and u", () => {
  test("كتب shows the textbook perfect and imperfect forms and its principal parts", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    expect(await textOf(perfectCell(page, SLOT_THIRD_MASCULINE_SINGULAR))).toBe(nfc(WORDS.kataba.text));
    expect(await textOf(perfectCell(page, SLOT_FIRST_SINGULAR))).toBe(nfc("كَتَبْتُ"));
    const imperfect = conjugationRegion(page).locator("tbody tr").nth(2).locator("td:not([aria-hidden])").nth(2);
    expect(await textOf(imperfect)).toBe(nfc("يَكْتُبُ"));
    expect(await textOf(principalPart(page, /verbal noun/))).toContain(nfc("كَتْب"));
    expect(await textOf(principalPart(page, /active participle/))).toContain(nfc("كَاتِب"));
    expect(await textOf(principalPart(page, /passive participle/))).toContain(nfc("مَكْتُوب"));
  });

  test("every conjugation cell is marked as Arabic", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    const cells = conjugationRegion(page).locator("tbody td:not([aria-hidden])");
    const count = await cells.count();
    expect(count).toBeGreaterThan(20);
    for (let index = 0; index < count; index += 1) {
      const cell = cells.nth(index);
      if ((await cell.innerText()).trim() !== "") {
        await expect(cell.locator('[lang="ar"]')).toHaveCount(1);
      }
    }
  });

  test("the conjugation region is keyboard reachable and named after the verb", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    await expect(conjugationRegion(page)).toHaveAttribute("tabindex", "0");
    await expect(conjugationRegion(page)).toHaveAttribute(
      "aria-label",
      `Active voice conjugation of ${WORDS.kataba.text}`,
    );
  });

  test("a noun has no conjugation table", async ({ page }) => {
    await page.goto(entryUrl("كتاب"));
    await expect(conjugationRegion(page)).toHaveCount(0);
  });

  test("the root box links to the entries of the root", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    await page.getByRole("link", { name: "3 terms" }).click();
    await expect(page).toHaveURL(/\/root\/%D9%83%D8%AA%D8%A8$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ك-ت-ب");
    await expect(page.getByRole("link", { name: WORDS.kataba.text })).toBeVisible();
    await expect(page.getByRole("link", { name: WORDS.kitab.text })).toBeVisible();
  });
});

test.describe("verb form listing", () => {
  test("Form VIII lists the assimilated verbs", async ({ page }) => {
    await page.goto("/arabic-verb-form/8");
    for (const formEight of FORM_VIII_CASES) {
      await expect(page.getByRole("link", { name: nfc(formEight.text) })).toBeVisible();
    }
  });

  test("the verb forms index counts the entries of each form", async ({ page }) => {
    await page.goto("/arabic-verb-form");
    await expect(page.getByRole("link", { name: "Form VIII" })).toBeVisible();
    await expect(page.getByText(`(${FORM_VIII_CASES.length} entries)`)).toBeVisible();
  });
});
