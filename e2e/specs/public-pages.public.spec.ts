import { MAIN_SITE_URL } from "../support/constants.ts";
import { WORDS } from "../support/data.ts";
import { expect, test } from "../support/fixtures.ts";
import { entryUrl, rootUrl, searchUrl } from "../support/urls.ts";

const absolute = (path: string): string => (path === "/" ? MAIN_SITE_URL : `${MAIN_SITE_URL}${path}`);

interface PageExpectation {
  name: string;
  path: string;
  title: string;
  canonical: string | null;
  noIndex?: boolean;
}

const PAGES: PageExpectation[] = [
  {
    name: "home",
    path: "/",
    title: "Tasrif — Arabic morphological engine and English–Arabic dictionary",
    canonical: "/",
  },
  { name: "English entry", path: entryUrl("book"), title: "book — Noun — Tasrif", canonical: entryUrl("book") },
  {
    name: "Arabic verb entry",
    path: entryUrl("كتب"),
    title: `${WORDS.kataba.text} — Verb — Tasrif`,
    canonical: entryUrl("كتب"),
  },
  {
    name: "entry shared by two headwords",
    path: entryUrl("كتاب"),
    title: `${WORDS.kitab.text} — Noun — Tasrif`,
    canonical: entryUrl("كتاب"),
  },
  { name: "Arabic list", path: "/lang/ar", title: "Arabic Entries — Tasrif", canonical: "/lang/ar" },
  { name: "English list", path: "/lang/en", title: "English Entries — Tasrif", canonical: "/lang/en" },
  { name: "root", path: rootUrl("كتب"), title: "Root ك-ت-ب — Tasrif", canonical: rootUrl("كتب") },
  {
    name: "verb forms",
    path: "/arabic-verb-form",
    title: "Arabic Verb Forms — Tasrif",
    canonical: "/arabic-verb-form",
  },
  {
    name: "verb form VIII",
    path: "/arabic-verb-form/8",
    title: "Arabic Verb Form VIII — Tasrif",
    canonical: "/arabic-verb-form/8",
  },
  {
    name: "appendix",
    path: "/appendix/arabic-verbs",
    title: "Appendix:Arabic verbs — Tasrif",
    canonical: "/appendix/arabic-verbs",
  },
  {
    name: "search results",
    path: searchUrl("book"),
    title: "Search: book — Tasrif",
    canonical: "/search",
    noIndex: true,
  },
  { name: "empty search", path: "/search", title: "Search — Tasrif", canonical: "/search", noIndex: true },
  { name: "login", path: "/auth/login", title: "Admin Login — Tasrif", canonical: null, noIndex: true },
];

test.describe("page metadata and structure", () => {
  for (const expected of PAGES) {
    test(`${expected.name} has its own title, exactly one h1 and its canonical and Open Graph URLs`, async ({
      page,
    }) => {
      const response = await page.goto(expected.path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(expected.title);
      await expect(page.locator("h1")).toHaveCount(1);

      const canonical = page.locator('link[rel="canonical"]');
      const ogUrl = page.locator('meta[property="og:url"]');
      if (expected.canonical === null) {
        await expect(canonical).toHaveCount(0);
      } else {
        await expect(canonical).toHaveAttribute("href", absolute(expected.canonical));
        await expect(ogUrl).toHaveAttribute("content", absolute(expected.canonical));
      }
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        `${MAIN_SITE_URL}/android-chrome-512x512.png`,
      );
      const robots = page.locator('meta[name="robots"]');
      if (expected.noIndex) {
        await expect(robots).toHaveAttribute("content", /noindex/);
      } else {
        await expect(robots).toHaveCount(0);
      }
    });
  }

  test("every page has a different title", async ({ page }) => {
    const titles: string[] = [];
    for (const expected of PAGES) {
      await page.goto(expected.path);
      titles.push(await page.title());
    }
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.every((title) => title.trim() !== "" && title !== "Tasrif")).toBe(true);
  });

  test("the document language is English and Arabic text carries lang=ar", async ({ page }) => {
    await page.goto(entryUrl("كتب"));
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 }).locator('[lang="ar"]')).toHaveText(WORDS.kataba.text);
  });

  test("the home page lists verified entries and never the unverified draft", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Recent Entries" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Random Entries" })).toBeVisible();
    const recent = page.locator("section", { has: page.getByRole("heading", { name: "Recent Entries" }) });
    await expect(recent.getByRole("link").first()).toBeVisible();
    await expect(page.getByText(WORDS.draft.text)).toHaveCount(0);
  });

  test("the skip link targets the main landmark", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();
  });
});

test.describe("robots and sitemap", () => {
  test("robots.txt disallows the private areas and points at sitemaps on the configured site", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const text = await response.text();
    for (const line of ["User-Agent: *", "Allow: /", "Disallow: /admin", "Disallow: /auth", "Disallow: /api"]) {
      expect(text).toContain(line);
    }
    expect(text).toContain(`Sitemap: ${MAIN_SITE_URL}/sitemap/0.xml`);
  });

  test("every sitemap listed in robots.txt and every URL inside answers 200", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    const sitemaps = [...robots.matchAll(/^Sitemap:\s*(\S+)$/gm)].map((match) => match[1] ?? "");
    expect(sitemaps.length).toBeGreaterThan(0);

    const locations: string[] = [];
    for (const sitemap of sitemaps) {
      expect(sitemap.startsWith(MAIN_SITE_URL)).toBe(true);
      const response = await request.get(sitemap.slice(MAIN_SITE_URL.length));
      expect(response.status(), sitemap).toBe(200);
      expect(response.headers()["content-type"]).toContain("xml");
      const xml = await response.text();
      locations.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? ""));
    }
    expect(locations.length).toBeGreaterThan(10);
    expect(new Set(locations).size).toBe(locations.length);

    for (const location of locations) {
      expect(location.startsWith(MAIN_SITE_URL), location).toBe(true);
      const response = await request.get(location.slice(MAIN_SITE_URL.length), { maxRedirects: 0 });
      expect(response.status(), location).toBe(200);
    }
  });

  test("the sitemap lists verified entries by slug and leaves out the unverified draft", async ({ request, seed }) => {
    const xml = await (await request.get("/sitemap/0.xml")).text();
    expect(xml).toContain(`${MAIN_SITE_URL}${entryUrl("book")}`);
    expect(xml).toContain(`${MAIN_SITE_URL}${entryUrl("to-write")}`);
    expect(xml).toContain(`${MAIN_SITE_URL}${entryUrl(seed.slugs.kataba ?? "")}`);
    expect(xml).not.toContain(encodeURIComponent(seed.slugs.draft ?? "missing"));
    expect(xml).not.toContain("/auth/login");
    expect(xml).not.toContain("/admin");
  });

  test("the web app manifest is served", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    const manifest = (await response.json()) as { name?: string; icons?: { src: string }[] };
    expect(manifest.name).toBeTruthy();
    for (const icon of manifest.icons ?? []) {
      expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    }
  });
});

test.describe("missing pages are real 404s", () => {
  const missing = [
    "/lang/ar?page=999",
    "/lang/en?page=999",
    "/lang/ar?page=2",
    `${rootUrl("كتب")}?page=999`,
    "/arabic-verb-form/8?page=999",
    "/lang/fr",
    "/arabic-verb-form/99",
    "/arabic-verb-form/0",
    "/arabic-verb-form/abc",
    rootUrl("ضضض"),
    "/entry/no-such-entry",
    entryUrl("هذا غير موجود"),
    "/appendix/missing",
    "/admin-not-a-page",
    "/sitemap/99.xml",
  ];

  for (const path of missing) {
    test(`${path} answers 404`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(404);
    });
  }

  test("a search page beyond the last page answers 404, before and after the page limit", async ({ request }) => {
    for (const path of ["/search?q=book&page=999", "/search?q=book&page=6", "/search?q=book&page=2"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
    }
  });

  test("a search with no results on the first page still answers 200", async ({ request }) => {
    for (const path of ["/search?q=zzzzqqqq", "/search", "/search?q=book"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
    }
  });

  test("a search page beyond the results renders the not found page", async ({ page }) => {
    await page.goto("/search?q=book&page=999");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    const directives = await page
      .locator('meta[name="robots"]')
      .evaluateAll((tags) => tags.map((tag) => tag.getAttribute("content") ?? ""));
    expect(directives.length).toBeGreaterThan(0);
    expect(directives.every((directive) => directive.includes("noindex"))).toBe(true);
  });

  test("an unverified entry has no public page", async ({ request, seed }) => {
    const response = await request.get(entryUrl(seed.slugs.draft ?? ""), { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });

  test("the not found page keeps the site chrome and offers a way back", async ({ page }) => {
    const response = await page.goto("/entry/no-such-entry");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Search Dictionary" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to the home page" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });
});
