import assert from "node:assert/strict";
import { test } from "node:test";
import { entrySlug, lexicalEntrySlug } from "~/lib/slug";
import { SLUG_CASES } from "./slug-cases.ts";

test("every documented rule gives the expected slug", () => {
  for (const { name, input, slug } of SLUG_CASES) {
    assert.equal(entrySlug(input), slug, name);
  }
});

test("a slug is its own slug", () => {
  for (const { name, input } of SLUG_CASES) {
    const slug = entrySlug(input);
    assert.equal(entrySlug(slug), slug, name);
  }
});

test("a slug contains no whitespace, no uppercase ascii and no edge hyphens", () => {
  for (const { name, input } of SLUG_CASES) {
    const slug = entrySlug(input);
    assert.equal(/\s|[A-Z]|^-|-$|--/.test(slug), false, name);
  }
});

test("an entry whose text leaves nothing is addressed by its id", () => {
  assert.equal(lexicalEntrySlug(42, "???"), "e-42");
  assert.equal(lexicalEntrySlug(42, "to write"), "to-write");
});

test("phrases that normalized_text merged stay apart", () => {
  assert.notEqual(entrySlug("a lot"), entrySlug("alot"));
  assert.notEqual(entrySlug("to write"), entrySlug("towrite"));
});

test("hamza forms, ta marbuta and alef maksura are never folded", () => {
  const words = ["أكل", "اكل", "إكل", "آكل", "مؤمن", "مومن", "سائل", "سايل", "مدرسة", "مدرسه", "على", "علي"];
  assert.equal(new Set(words.map(entrySlug)).size, words.length);
});
