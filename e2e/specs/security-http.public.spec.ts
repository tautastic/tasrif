import { expect, test } from "../support/fixtures.ts";
import { entryUrl } from "../support/urls.ts";

test.describe("request validation", () => {
  test("a malformed percent-encoding in an entry path is a 400", async ({ request }) => {
    const response = await request.get("/entry/%FF");
    expect(response.status()).toBe(400);
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("a truncated percent-encoding in a language path is a 400", async ({ request }) => {
    const response = await request.get("/lang/%E0%A4%A");
    expect(response.status()).toBe(400);
  });

  test("malformed encodings are rejected on every public path family", async ({ request }) => {
    for (const path of ["/root/%FF", "/arabic-verb-form/%C0%AF", "/appendix/%E0%A4%A", "/entry/%"]) {
      expect((await request.get(path)).status(), path).toBe(400);
    }
  });

  test("an encoded NUL byte in an entry path is a 404", async ({ request }) => {
    const response = await request.get("/entry/%00");
    expect(response.status()).toBe(404);
  });

  test("an encoded NUL byte inside a slug is a 404 on the root and verb form paths", async ({ request }) => {
    expect((await request.get("/root/%D9%83%00%D8%AA")).status()).toBe(404);
    expect((await request.get("/appendix/arabic%00verbs")).status()).toBe(404);
  });
});

test.describe("response headers", () => {
  const pages = ["/", entryUrl("book"), "/auth/login", "/search?q=book", "/lang/en", "/entry/does-not-exist"];

  for (const path of pages) {
    test(`${path} carries the content security policy and does not advertise the framework`, async ({ request }) => {
      const response = await request.get(path);
      const headers = response.headers();
      const policy = headers["content-security-policy"] ?? "";
      for (const directive of [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "connect-src 'self'",
        "img-src 'self' data:",
      ]) {
        expect(policy, `${path} policy`).toContain(directive);
      }
      expect(headers["x-powered-by"]).toBeUndefined();
      expect(headers["permissions-policy"]).toContain("camera=()");
      expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    });
  }

  test("API responses carry the content security policy too", async ({ request }) => {
    const response = await request.get("/api/auth/status");
    expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers()["x-powered-by"]).toBeUndefined();
  });

  test("the main public pages load in a browser without content security policy violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/content security policy|refused to (load|execute|apply|connect)/i.test(message.text())) {
        violations.push(message.text());
      }
    });
    page.on("pageerror", (error) => violations.push(error.message));
    for (const path of ["/", entryUrl("book"), "/lang/ar", "/auth/login", "/search?q=book", "/appendix/arabic-verbs"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    expect(violations).toEqual([]);
  });

  test("the page loads only same-origin resources and serves its font with long caching", async ({ page }) => {
    const origins = new Set<string>();
    page.on("request", (candidate) => {
      if (!candidate.url().startsWith("data:")) {
        origins.add(new URL(candidate.url()).origin);
      }
    });
    const fontResponse = page.waitForResponse((response) => response.url().includes("/fonts/"));
    await page.goto(entryUrl("book"));
    const font = await fontResponse;
    expect(font.status()).toBe(200);
    expect(font.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect([...origins]).toEqual([new URL(page.url()).origin]);
  });
});
