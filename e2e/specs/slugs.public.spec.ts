import { WORDS } from "../support/data.ts";
import { expect, test } from "../support/fixtures.ts";
import { linkedSenses, redirectTarget } from "../support/ui.ts";
import { entryUrl } from "../support/urls.ts";

test.describe("entry slugs", () => {
  test("a multi-word English entry is served at its hyphenated slug", async ({ page }) => {
    const response = await page.goto("/entry/to-write");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("to write");
    await expect(page).toHaveTitle("to write — Verb — Tasrif");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/entry\/to-write$/);
  });

  test("the old unspaced URL answers a permanent redirect to the slug", async ({ request }) => {
    const response = await request.get("/entry/towrite", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(redirectTarget(response)).toBe("/entry/to-write");
  });

  test("the old URL leads a browser to the slug page", async ({ page }) => {
    await page.goto("/entry/towrite");
    await expect(page).toHaveURL(/\/entry\/to-write$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("to write");
  });

  test("a mixed-case and spaced spelling redirects to the slug as well", async ({ request }) => {
    const response = await request.get(`/entry/${encodeURIComponent("To Write")}`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(redirectTarget(response)).toBe("/entry/to-write");
  });

  test("an Arabic entry is served at its unvocalised slug and vocalised spellings redirect to it", async ({
    request,
    seed,
  }) => {
    expect((await request.get(entryUrl(seed.slugs.kataba ?? ""), { maxRedirects: 0 })).status()).toBe(200);
    const vocalised = await request.get(entryUrl(WORDS.kataba.text), { maxRedirects: 0 });
    expect(vocalised.status()).toBe(308);
    expect(redirectTarget(vocalised)).toBe(entryUrl(seed.slugs.kataba ?? ""));
  });
});

test.describe("links between entries", () => {
  test("translation links on an English entry go to slug URLs with sense anchors that exist on the target", async ({
    page,
    seed,
  }) => {
    await page.goto("/entry/book");
    const hrefs = await linkedSenses(page, seed.senses.book ?? 0, "Translations")
      .getByRole("link")
      .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")));
    expect(hrefs).toEqual([
      `${entryUrl(seed.slugs.kuttab ?? "")}#sense-${seed.senses.kuttab}`,
      `${entryUrl(seed.slugs.kitab ?? "")}#sense-${seed.senses.kitab}`,
    ]);

    for (const href of hrefs) {
      const senseId = href?.split("#sense-")[1] ?? "";
      await page.goto(href ?? "/");
      await expect(page.locator(`#sense-${senseId}`)).toBeVisible();
      await expect(page.locator(":target")).toHaveAttribute("id", `sense-${senseId}`);
    }
  });

  test("both translation links of one sense are shown, the more frequent first, with domain and note", async ({
    page,
    seed,
  }) => {
    await page.goto("/entry/book");
    const items = linkedSenses(page, seed.senses.book ?? 0, "Translations");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText(WORDS.kuttab.text);
    await expect(items.nth(0)).toContainText("literary");
    await expect(items.nth(0)).toContainText("second book");
    await expect(items.nth(1)).toContainText(WORDS.kitab.text);
    await expect(items.nth(1)).toContainText("general");
  });

  test("clicking a translation lands on the headword and highlights the linked sense", async ({ page, seed }) => {
    await page.goto("/entry/to-write");
    await page.getByRole("link", { name: WORDS.kataba.text }).click();
    await expect(page).toHaveURL(`${entryUrl(seed.slugs.kataba ?? "")}#sense-${seed.senses.kataba}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(WORDS.kataba.text);
    await expect(page.locator(`#sense-${seed.senses.kataba}`)).toBeInViewport();
  });

  test("a related-sense link carries the relation type and a working anchor", async ({ page, seed }) => {
    await page.goto(entryUrl(seed.slugs.kitab ?? ""));
    const related = linkedSenses(page, seed.senses.kitab ?? 0, "Related")
      .filter({ hasText: "near synonym" })
      .getByRole("link", { name: WORDS.kataba.text });
    await expect(related).toHaveAttribute("href", `${entryUrl(seed.slugs.kataba ?? "")}#sense-${seed.senses.kataba}`);
    await related.click();
    await expect(page).toHaveURL(/#sense-\d+$/);
    await expect(page.locator(`#sense-${seed.senses.kataba}`)).toBeInViewport();
  });

  test("Arabic link text carries lang=ar and English link text lang=en", async ({ page }) => {
    await page.goto("/entry/book");
    const arabic = await page.locator(`a[href*="#sense-"] [lang="ar"]`).allInnerTexts();
    expect(arabic.sort()).toEqual([WORDS.kitab.text, WORDS.kuttab.text].sort());
    await page.goto(entryUrl("كتاب"));
    await expect(page.locator(`a[href*="#sense-"] [lang="en"]`)).toHaveText(["book", "book"]);
  });

  test("the headword anchor of every entry on a shared slug page exists", async ({ page, seed }) => {
    await page.goto(entryUrl("كتاب"));
    await expect(page.locator(`#entry-${seed.entries.kitab}`)).toBeVisible();
    await expect(page.locator(`#entry-${seed.entries.kuttab}`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2 }).filter({ hasText: WORDS.kuttab.text })).toBeVisible();
  });
});
