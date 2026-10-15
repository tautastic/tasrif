import { WORDS } from "../support/data.ts";
import { expect, test } from "../support/fixtures.ts";
import { captureRouterStateTree, newAnonymousClient } from "../support/session.ts";

test.describe("anonymous access to the admin area", () => {
  test("anonymous RSC requests to every admin page redirect to the login page without data", async ({
    adminPage,
    playwright,
    baseURL,
    seed,
    clientIp,
  }) => {
    const tree = await captureRouterStateTree(adminPage);
    const anonymous = await newAnonymousClient(playwright, baseURL as string, { "x-real-ip": clientIp });
    const entryId = seed.entries.kataba;
    const patternId = seed.patterns.editor;
    const overrideId = seed.overrides.editor;
    const paths = [
      "/admin",
      "/admin/entries",
      `/admin/entries/${entryId}`,
      `/admin/edit-entry/${entryId}`,
      `/admin/delete-entry/${entryId}`,
      "/admin/new-entry",
      "/admin/morph-patterns",
      "/admin/morph-patterns/new",
      `/admin/morph-patterns/${patternId}`,
      `/admin/morph-patterns/${patternId}/edit`,
      `/admin/morph-patterns/${patternId}/delete`,
      `/admin/morph-patterns/${patternId}/overrides/new`,
      `/admin/morph-patterns/${patternId}/overrides/${overrideId}/edit`,
      `/admin/morph-patterns/${patternId}/overrides/${overrideId}/delete`,
    ];
    const privateMarkers = [WORDS.draft.text, "vocalicTemplate", "imperfect_stem", "test only, pattern editor"];

    for (const path of paths) {
      const response = await anonymous.get(`${path}?_rsc=e2e12`, {
        maxRedirects: 0,
        headers: {
          RSC: "1",
          "Next-Router-State-Tree": tree,
          "Next-Url": "/admin",
          Accept: "text/x-component",
        },
      });
      expect(response.status(), path).toBe(307);
      const location = new URL(response.headers().location ?? "", baseURL);
      expect(location.pathname, path).toBe("/auth/login");
      expect(location.searchParams.get("next"), path).toBe(path);
      const body = await response.text();
      for (const marker of privateMarkers) {
        expect(body, `${path} leaked ${marker}`).not.toContain(marker);
      }
    }
    await anonymous.dispose();
  });

  test("plain anonymous requests to admin pages redirect to the login page with the target in next", async ({
    request,
    seed,
  }) => {
    for (const path of ["/admin", "/admin/entries", `/admin/edit-entry/${seed.entries.book}`, "/admin/new-entry"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      const location = new URL(response.headers().location ?? "", "http://placeholder.invalid");
      expect(location.pathname).toBe("/auth/login");
      expect(location.searchParams.get("next")).toBe(path);
      expect(response.headers()["cache-control"]).toContain("no-store");
    }
  });

  test("anonymous writes to admin URLs are rejected with 401 JSON", async ({ request, seed }) => {
    for (const method of ["post", "put", "delete"] as const) {
      const response = await request[method](`/admin/edit-entry/${seed.entries.book}`, {
        headers: { "Next-Action": "00deadbeef00deadbeef00deadbeef00deadbeef00" },
        data: "[]",
      });
      expect(response.status(), method).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }
  });

  test("the auth status endpoint reports an anonymous visitor as not an admin", async ({ request }) => {
    const response = await request.get("/api/auth/status");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ isAdmin: false });
  });

  test("the admin-only JSON APIs refuse anonymous callers", async ({ request }) => {
    const response = await request.get("/api/senses/search?query=book&language=en");
    expect(response.status()).toBe(401);
  });
});
