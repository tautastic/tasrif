import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { findTags, renderMarkup, textOf } from "./public-render.ts";

const ROOT = join(import.meta.dirname, "..", "..");

const appendixModule = await import("~/app/appendix/[slug]/page");
const notFoundModule = await import("~/app/not-found");
const { default: FormReference } = await import("~/components/entry/FormReference");
const { formatMorphPatternFormNumber } = await import("~/lib/formatting");

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "digest" in error && error.digest === "NEXT_HTTP_ERROR_FALLBACK;404";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

test("the appendix is rendered on demand and cached, never prerendered at build time", () => {
  assert.deepEqual(appendixModule.generateStaticParams(), []);
  assert.equal(appendixModule.revalidate, 3600);
  assert.equal("dynamic" in appendixModule, false);
});

test("the appendix metadata uses a relative canonical path so the runtime site URL applies", async () => {
  const metadata = await appendixModule.generateMetadata(params("arabic-verbs"));
  assert.equal(metadata.title, "Appendix:Arabic verbs");
  assert.deepEqual(metadata.alternates, { canonical: "/appendix/arabic-verbs" });
  assert.equal(metadata.openGraph?.url, "/appendix/arabic-verbs");
});

test("unknown appendix slugs are a 404, including inherited object keys and broken encodings", async () => {
  for (const slug of ["nope", "constructor", "__proto__", "toString", "arabic-verbs/extra", "%E0%A4%A"]) {
    await assert.rejects(appendixModule.generateMetadata(params(slug)), isNotFound, slug);
    await assert.rejects(appendixModule.default(params(slug)), isNotFound, slug);
  }
});

test("every verb form link on entry pages points at a section id that exists in the appendix", async () => {
  const page = await appendixModule.default(params("arabic-verbs"));
  const html = renderMarkup(page);
  const ids = new Set(findTags(html, "h2").map((heading) => heading.attributes.id));
  assert.equal(findTags(html, "h1").length, 1);
  for (let formNumber = 1; formNumber <= 10; formNumber++) {
    const link = findTags(renderMarkup(createElement(FormReference, { formNumber, formDescription: "a ~ u" })), "a")[0];
    const anchor = link?.attributes.href?.split("#")[1];
    assert.equal(link?.attributes.href, `/appendix/arabic-verbs#Form_${formatMorphPatternFormNumber(formNumber)}`);
    assert.ok(anchor && ids.has(anchor), `Form ${formNumber} anchor ${anchor}`);
  }
});

test("Arabic words of the appendix are marked with lang=ar and link to entries by their plain spelling", async () => {
  const html = renderMarkup(await appendixModule.default(params("arabic-verbs")));
  const arabicLinks = findTags(html, "a").filter((anchor) => anchor.attributes.href?.startsWith("/entry/"));
  assert.ok(arabicLinks.length > 20);
  assert.ok(arabicLinks.every((anchor) => !anchor.attributes.href?.includes("%D9%8E")));
  assert.ok(html.includes('<span lang="ar">'));
});

test("the 404 page embeds no absolute URL, so a prerendered copy cannot carry a build-time domain", () => {
  const { metadata } = notFoundModule;
  assert.equal(metadata.title, "Page not found");
  assert.ok(metadata.openGraph);
  assert.equal("url" in metadata.openGraph, false);
  assert.equal("images" in metadata.openGraph, false);
  assert.equal(metadata.alternates, undefined);
  const html = renderMarkup(createElement(notFoundModule.default));
  assert.equal(findTags(html, "h1").length, 1);
  assert.equal(/https?:\/\//.test(html), false);
  assert.ok(textOf(html).includes("Page not found"));
});

test("statically prerendered routes do not read the site URL", () => {
  for (const file of ["src/app/not-found.tsx", "src/app/global-error.tsx", "src/app/manifest.ts"]) {
    const source = readFileSync(join(ROOT, file), "utf8");
    assert.equal(/getSiteUrl|buildPageMetadata|SITE_URL|DEFAULT_OPEN_GRAPH/.test(source), false, file);
  }
});
