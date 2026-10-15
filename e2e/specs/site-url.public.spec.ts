import { ALT_SITE_URL, MAIN_SITE_URL } from "../support/constants.ts";
import { expect, test } from "../support/fixtures.ts";
import { findFreePort } from "../support/ports.ts";
import { type RunningServer, startWebServer } from "../support/server.ts";
import { readState } from "../support/state.ts";
import { entryUrl } from "../support/urls.ts";

test.describe("SITE_URL is read at runtime", () => {
  test.describe.configure({ mode: "serial" });

  let alternate: RunningServer;

  test.beforeAll(async () => {
    alternate = await startWebServer({
      port: await findFreePort(),
      database: readState().database,
      siteUrl: ALT_SITE_URL,
      logName: "server-alt",
    });
  });

  test.afterAll(async () => {
    await alternate.stop();
  });

  const read = async (request: import("@playwright/test").APIRequestContext, path: string) =>
    (await request.get(`${alternate.baseUrl}${path}`)).text();

  test("canonical and Open Graph URLs follow the value the server was started with", async ({ page }) => {
    for (const path of ["/", entryUrl("book"), "/appendix/arabic-verbs"]) {
      await page.goto(`${alternate.baseUrl}${path}`);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical, path).toBe(path === "/" ? ALT_SITE_URL : `${ALT_SITE_URL}${path}`);
      const og = await page.locator('meta[property="og:url"]').getAttribute("content");
      expect(og, path).toBe(canonical);
      expect(await page.content()).not.toContain(MAIN_SITE_URL);
    }
  });

  test("robots.txt, the sitemap and the manifest use it too", async ({ request }) => {
    const robots = await read(request, "/robots.txt");
    expect(robots).toContain(`Sitemap: ${ALT_SITE_URL}/sitemap/0.xml`);
    expect(robots).not.toContain(MAIN_SITE_URL);

    const sitemap = await read(request, "/sitemap/0.xml");
    expect(sitemap).toContain(`${ALT_SITE_URL}${entryUrl("book")}`);
    expect(sitemap).not.toContain(MAIN_SITE_URL);

    const manifest = await read(request, "/manifest.webmanifest");
    expect(manifest).not.toContain(MAIN_SITE_URL);
  });

  test("the main server still answers with its own value", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain(`Sitemap: ${MAIN_SITE_URL}/sitemap/0.xml`);
    expect(robots).not.toContain(ALT_SITE_URL);
  });
});
