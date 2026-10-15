import type { Locator, Page } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow } from "../support/axe.ts";
import { WORDS } from "../support/data.ts";
import { expect, test } from "../support/fixtures.ts";
import { entryUrl } from "../support/urls.ts";

const SLOT_FIRST_SINGULAR = 0;
const SLOT_THIRD_MASCULINE_SINGULAR = 2;
const PASSIVE_MOOD_ROWS = 8;
const ACTIVE_MOOD_ROWS = 10;

const nfc = (value: string): string => value.normalize("NFC");

const activeRegion = (page: Page): Locator => page.getByRole("region", { name: /^Active voice conjugation of/ });
const passiveRegion = (page: Page): Locator => page.getByRole("region", { name: /^Passive voice conjugation of/ });

const cellAt = (region: Locator, row: number, slot: number): Locator =>
  region.locator("tbody tr").nth(row).locator("td:not([aria-hidden])").nth(slot);

const textOf = async (locator: Locator): Promise<string> => nfc((await locator.innerText()).trim());

test.describe("the passive voice of a transitive verb", () => {
  test("كتب shows the passive block after the active one, each in a region named after the verb and the voice", async ({
    page,
  }) => {
    await page.goto(entryUrl("كتب"));
    await expect(activeRegion(page)).toHaveAttribute("aria-label", `Active voice conjugation of ${WORDS.kataba.text}`);
    await expect(passiveRegion(page)).toHaveAttribute(
      "aria-label",
      `Passive voice conjugation of ${WORDS.kataba.text}`,
    );
    await expect(passiveRegion(page)).toHaveAttribute("tabindex", "0");
    const order = await page.evaluate(() => {
      const regions = [...document.querySelectorAll('[role="region"]')];
      return regions.map((region) => region.getAttribute("aria-label")?.split(" ")[0]);
    });
    expect(order).toEqual(["Active", "Passive"]);
  });

  test("the passive perfect and imperfect are the textbook forms", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    const region = passiveRegion(page);
    expect(await textOf(cellAt(region, 0, SLOT_FIRST_SINGULAR))).toBe(nfc("كُتِبْتُ"));
    expect(await textOf(cellAt(region, 0, SLOT_THIRD_MASCULINE_SINGULAR))).toBe(nfc("كُتِبَ"));
    expect(await textOf(cellAt(region, 2, SLOT_THIRD_MASCULINE_SINGULAR))).toBe(nfc("يُكْتَبُ"));
    expect(await textOf(cellAt(region, 4, SLOT_THIRD_MASCULINE_SINGULAR))).toBe(nfc("يُكْتَبَ"));
    expect(await textOf(cellAt(region, 6, SLOT_THIRD_MASCULINE_SINGULAR))).toBe(nfc("يُكْتَبْ"));
  });

  test("the passive block has no imperative and the active block keeps its own", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    await expect(passiveRegion(page).locator("tbody tr")).toHaveCount(PASSIVE_MOOD_ROWS);
    await expect(activeRegion(page).locator("tbody tr")).toHaveCount(ACTIVE_MOOD_ROWS);
    await expect(passiveRegion(page).getByText("imperative")).toHaveCount(0);
  });

  test("every passive cell is marked as Arabic and every header cell has a scope", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    const region = passiveRegion(page);
    const cells = region.locator("tbody td:not([aria-hidden])");
    const count = await cells.count();
    expect(count).toBeGreaterThan(20);
    for (let index = 0; index < count; index += 1) {
      const cell = cells.nth(index);
      if ((await cell.innerText()).trim() !== "") {
        await expect(cell.locator('[lang="ar"]')).toHaveCount(1);
      }
    }
    const unscoped = await region
      .locator("th")
      .evaluateAll((nodes) => nodes.filter((node) => !node.getAttribute("scope")).length);
    expect(unscoped).toBe(0);
  });

  test("the two voice tables are named by their own headings", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    await expect(page.getByRole("table", { name: /^active voice/ })).toHaveCount(1);
    await expect(page.getByRole("table", { name: /^passive voice/ })).toHaveCount(1);
  });

  test("a form VIII verb carries its assimilated passive", async ({ page }) => {
    await page.goto(entryUrl("اصطبر"));
    await expect(passiveRegion(page)).toBeVisible();
    expect(await textOf(cellAt(passiveRegion(page), 0, SLOT_THIRD_MASCULINE_SINGULAR))).toBe(nfc("اُصْطُبِرَ"));
  });

  test("a noun has no passive block", async ({ page }) => {
    await page.goto(entryUrl("كتاب"));
    await expect(passiveRegion(page)).toHaveCount(0);
  });

  test("the entry page with both voices has no axe violations", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    await expect(passiveRegion(page)).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe("on a 375 pixel wide screen", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("the passive table scrolls inside its own region and the page does not", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    const region = passiveRegion(page);
    await expect(region).toBeVisible();
    const metrics = await region.evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    expect(metrics.scroll).toBeGreaterThan(metrics.client);
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });
});
