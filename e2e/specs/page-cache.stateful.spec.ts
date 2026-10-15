import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createEnglishEntry, removeEntries } from "../support/entries.ts";
import { expect, test } from "../support/fixtures.ts";
import { STANDALONE_DIR } from "../support/paths.ts";
import { entryUrl } from "../support/urls.ts";

const FLOOD_REQUESTS = 300;
const FLOOD_CONCURRENCY = 10;
const GROWTH_ALLOWANCE = 5;

const countFiles = async (directory: string): Promise<number> => {
  let total = 0;
  for (const item of await readdir(directory, { withFileTypes: true })) {
    total += item.isDirectory() ? await countFiles(join(directory, item.name)) : 1;
  }
  return total;
};

test.describe("page cache", () => {
  test("a valid entry page comes from the cache from the second request on", async ({ request }) => {
    await request.get(entryUrl("book"));
    const second = await request.get(entryUrl("book"));
    expect(second.status()).toBe(200);
    expect(second.headers()["x-nextjs-cache"]).toBe("HIT");
  });

  test("an admin edit shows on the very next request", async ({ adminPage, db, request }) => {
    await removeEntries(db, "e2e cache probe");
    const entry = await createEnglishEntry(db, { text: "e2e cache probe", definitions: ["first wording"] });
    const path = entryUrl(entry.slug);

    expect(await (await request.get(path)).text()).toContain("first wording");
    expect((await request.get(path)).headers()["x-nextjs-cache"]).toBe("HIT");

    await adminPage.goto(`/admin/edit-entry/${entry.id}`);
    await adminPage.getByLabel("Definitions (one per line)").first().fill("second wording");
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(new RegExp(`${path}$`));

    const after = await (await request.get(path)).text();
    expect(after).toContain("second wording");
    expect(after).not.toContain("first wording");
  });

  test("renaming an entry keeps the old URL alive and the cache never serves the old page", async ({
    adminPage,
    db,
    request,
  }) => {
    await removeEntries(db, "e2e cache alpha", "e2e cache beta");
    const entry = await createEnglishEntry(db, { text: "e2e cache alpha" });
    await request.get(entryUrl("e2e-cache-alpha"));
    expect((await request.get(entryUrl("e2e-cache-alpha"))).headers()["x-nextjs-cache"]).toBe("HIT");

    await adminPage.goto(`/admin/edit-entry/${entry.id}`);
    await adminPage.getByLabel("Text", { exact: true }).fill("e2e cache beta");
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(/\/entry\/e2e-cache-beta$/);

    const old = await request.get(entryUrl("e2e-cache-alpha"), { maxRedirects: 0 });
    expect(old.status()).toBe(308);
    expect(old.headers().location).toContain(entryUrl("e2e-cache-beta"));
    const renamed = await request.get(entryUrl("e2e-cache-beta"));
    expect(renamed.status()).toBe(200);
    expect(await renamed.text()).toContain("e2e cache beta");
  });

  test("@slow unknown slugs are never cached and do not grow the build output", async ({ request }) => {
    test.setTimeout(120_000);
    const cacheDirectory = join(STANDALONE_DIR, ".next");
    const before = await countFiles(cacheDirectory);
    const statuses: number[] = [];
    const cached: string[] = [];
    const slugs = Array.from(
      { length: FLOOD_REQUESTS },
      (_, index) => `flood-${index}-${Math.random().toString(36).slice(2, 10)}`,
    );
    for (let start = 0; start < slugs.length; start += FLOOD_CONCURRENCY) {
      const responses = await Promise.all(
        slugs.slice(start, start + FLOOD_CONCURRENCY).map((slug) => request.get(entryUrl(slug), { maxRedirects: 0 })),
      );
      for (const response of responses) {
        statuses.push(response.status());
        const header = response.headers()["x-nextjs-cache"];
        if (header === "HIT" || header === "STALE") {
          cached.push(header);
        }
      }
    }
    expect(new Set(statuses)).toEqual(new Set([404]));
    expect(cached).toEqual([]);
    const after = await countFiles(cacheDirectory);
    expect(after - before).toBeLessThanOrEqual(GROWTH_ALLOWANCE);
  });
});
