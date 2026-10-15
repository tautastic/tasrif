import type { Page } from "@playwright/test";
import { WORDS } from "../support/data.ts";
import { expect, test } from "../support/fixtures.ts";
import { entryUrl, searchUrl } from "../support/urls.ts";

const searchBox = (page: Page) => page.getByRole("combobox", { name: "Search Dictionary" });
const suggestions = (page: Page) => page.getByRole("listbox", { name: "Search suggestions" });

const typeQuery = async (page: Page, query: string): Promise<void> => {
  await searchBox(page).click();
  await searchBox(page).pressSequentially(query);
  await expect(suggestions(page)).toBeVisible();
};

test.describe("search results page", () => {
  test("results are links to the entry pages", async ({ page }) => {
    await page.goto(searchUrl("كتب"));
    await expect(page.getByRole("heading", { level: 1, name: "Search results for “كتب”" })).toBeVisible();
    const links = page.getByRole("main").getByRole("list").getByRole("link");
    await expect(links).toHaveCount(3);
    const targets = await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")));
    expect(targets).toEqual(expect.arrayContaining([entryUrl("كتب"), entryUrl("كتاب")]));
    for (const target of targets) {
      expect(target?.startsWith("/entry/")).toBe(true);
    }
    await expect(links.filter({ hasText: WORDS.kataba.text })).toHaveAttribute("href", entryUrl("كتب"));
    await expect(page.getByText("Arabic · ك-ت-ب").first()).toBeVisible();
  });

  test("an English query finds the English entry", async ({ page }) => {
    await page.goto(searchUrl("book"));
    await expect(page.getByRole("main").getByRole("link", { name: "book" })).toHaveAttribute("href", "/entry/book");
  });

  test("a query without matches says so", async ({ page }) => {
    await page.goto(searchUrl("qqqqzzzz"));
    await expect(page.locator("p:visible", { hasText: "No entries found for “qqqqzzzz”." })).toHaveCount(1);
  });

  test("the unverified draft is never a search result", async ({ page }) => {
    await page.goto(searchUrl(WORDS.draft.text));
    await expect(page.getByRole("main").getByRole("link", { name: WORDS.draft.text })).toHaveCount(0);
  });

  test("the search form on the results page submits to /search", async ({ page }) => {
    await page.goto("/search");
    await page.getByRole("searchbox", { name: "Search Dictionary" }).fill("book");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/\/search\?q=book$/);
  });
});

test.describe("search combobox", () => {
  test("pressing Enter with no highlighted suggestion goes to the results page", async ({ page }) => {
    await page.goto("/");
    await typeQuery(page, "book");
    await expect(searchBox(page)).not.toHaveAttribute("aria-activedescendant", /.+/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=book$/);
    await expect(page.getByRole("heading", { level: 1, name: "Search results for “book”" })).toBeVisible();
  });

  test("an Arabic query without a highlight also goes to the results page", async ({ page }) => {
    await page.goto("/");
    await typeQuery(page, "كتب");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`/search?q=${encodeURIComponent("كتب")}`);
  });

  test("the arrow keys move the active descendant and Enter opens the highlighted entry", async ({ page }) => {
    await page.goto("/");
    const box = searchBox(page);
    await expect(box).toHaveAttribute("aria-expanded", "false");
    await typeQuery(page, "book");
    await expect(box).toHaveAttribute("aria-expanded", "true");
    await expect(box).toHaveAttribute("aria-controls", "entry-search-results");
    await expect(box).toHaveAttribute("aria-autocomplete", "list");

    await page.keyboard.press("ArrowDown");
    await expect(box).toHaveAttribute("aria-activedescendant", "entry-search-option-0");
    const first = page.locator("#entry-search-option-0");
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(first).toHaveAttribute("role", "option");

    await page.keyboard.press("ArrowDown");
    await expect(box).toHaveAttribute("aria-activedescendant", "entry-search-option-1");
    await expect(first).toHaveAttribute("aria-selected", "false");

    await page.keyboard.press("ArrowUp");
    await expect(box).toHaveAttribute("aria-activedescendant", "entry-search-option-0");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/entry\/book$/);
  });

  test("the suggestions are real links and the last one opens all results", async ({ page }) => {
    await page.goto("/");
    await typeQuery(page, "كتب");
    const options = suggestions(page).getByRole("option");
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(4);
    const hrefs = await options.evaluateAll((nodes) =>
      nodes.map((node) => ({ tag: node.tagName, href: node.getAttribute("href") })),
    );
    for (const option of hrefs) {
      expect(option.tag).toBe("A");
      expect(option.href).toBeTruthy();
    }
    expect(hrefs.at(-1)?.href).toBe(searchUrl("كتب"));
    await expect(options.last()).toHaveText("See all results for “كتب”");
  });

  test("Escape closes the suggestions and keeps the text, a second Escape clears it", async ({ page }) => {
    await page.goto("/");
    const box = searchBox(page);
    await typeQuery(page, "book");
    await page.keyboard.press("Escape");
    await expect(suggestions(page)).toHaveCount(0);
    await expect(box).toHaveAttribute("aria-expanded", "false");
    await expect(box).toHaveValue("book");
    await expect(box).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(box).toHaveValue("");
  });

  test("Tab leaves the field, closes the suggestions and does not navigate", async ({ page }) => {
    await page.goto("/");
    await typeQuery(page, "book");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await expect(suggestions(page)).toHaveCount(0);
    await expect(searchBox(page)).not.toBeFocused();
    await expect(page).toHaveURL(/\/$/);
  });

  test("a query with no matches announces that nothing was found", async ({ page }) => {
    await page.goto("/");
    await searchBox(page).click();
    await searchBox(page).pressSequentially("qqqqzzzz");
    await expect(page.getByRole("status").filter({ hasText: "No entries found." })).toBeAttached();
    await expect(suggestions(page)).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=qqqqzzzz$/);
  });

  test("one character does not search yet", async ({ page }) => {
    const searches: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/entries/search")) {
        searches.push(request.url());
      }
    });
    await page.goto("/");
    await searchBox(page).click();
    await searchBox(page).pressSequentially("b");
    await expect(suggestions(page)).toHaveCount(0);
    await searchBox(page).pressSequentially("o");
    await expect(suggestions(page)).toBeVisible();
    expect(searches).toHaveLength(1);
  });
});

test.describe("search API", () => {
  test("the entries search returns slugs and is safe with empty and overlong queries", async ({ request }) => {
    const found = await request.get(`/api/entries/search?query=${encodeURIComponent("كتب")}`);
    expect(found.status()).toBe(200);
    const body = (await found.json()) as { items: { slug: string; text: string }[] };
    expect(body.items.map((item) => item.slug)).toEqual(expect.arrayContaining(["كتب", "كتاب"]));

    const empty = await request.get("/api/entries/search?query=");
    expect(await empty.json()).toEqual({ items: [] });

    const long = await request.get(`/api/entries/search?query=${"a".repeat(101)}`);
    expect(long.status()).toBe(400);
  });
});
