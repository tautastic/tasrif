import assert from "node:assert/strict";
import { test } from "node:test";
import "./public-render.ts";

const { countPages, ENTRY_LIST_PAGE_SIZE, notFoundIfOutOfRange, parsePageParam, withPageParam, withPageTitle } =
  await import("~/lib/pagination");

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "digest" in error && error.digest === "NEXT_HTTP_ERROR_FALLBACK;404";

test("parsePageParam defaults to the first page for missing or invalid values", () => {
  for (const value of [undefined, "", "0", "-1", "-3.5", "abc", "NaN", "Infinity", "-Infinity", "0.9", " "]) {
    assert.equal(parsePageParam(value), 1, JSON.stringify(value));
  }
});

test("parsePageParam floors fractional values and trims whitespace", () => {
  assert.equal(parsePageParam("2"), 2);
  assert.equal(parsePageParam("2.9"), 2);
  assert.equal(parsePageParam(" 7 "), 7);
  assert.equal(parsePageParam("1e2"), 100);
});

test("parsePageParam uses the first value of a repeated parameter", () => {
  assert.equal(parsePageParam(["3", "9"]), 3);
  assert.equal(parsePageParam([]), 1);
});

test("parsePageParam caps absurd page numbers so queries stay bounded", () => {
  assert.equal(parsePageParam("999999999999"), 1_000_000);
  assert.equal(parsePageParam("1000000"), 1_000_000);
  assert.equal(parsePageParam("1000001"), 1_000_000);
});

test("countPages rounds up", () => {
  assert.equal(countPages(0, 100), 0);
  assert.equal(countPages(1, 100), 1);
  assert.equal(countPages(100, 100), 1);
  assert.equal(countPages(101, 100), 2);
});

test("notFoundIfOutOfRange passes for pages that exist", () => {
  assert.doesNotThrow(() => notFoundIfOutOfRange({ page: 1, total: 1, pageSize: ENTRY_LIST_PAGE_SIZE }));
  assert.doesNotThrow(() => notFoundIfOutOfRange({ page: 3, total: 250, pageSize: 100 }));
  assert.doesNotThrow(() => notFoundIfOutOfRange({ page: 2, total: 101, pageSize: 100 }));
});

test("notFoundIfOutOfRange raises a 404 for pages past the end", () => {
  assert.throws(() => notFoundIfOutOfRange({ page: 4, total: 250, pageSize: 100 }), isNotFound);
  assert.throws(() => notFoundIfOutOfRange({ page: 2, total: 100, pageSize: 100 }), isNotFound);
  assert.throws(() => notFoundIfOutOfRange({ page: 1_000_000, total: 3, pageSize: 100 }), isNotFound);
});

test("notFoundIfOutOfRange raises a 404 when the list is empty, even for the first page", () => {
  assert.throws(() => notFoundIfOutOfRange({ page: 1, total: 0, pageSize: 100 }), isNotFound);
});

test("withPageParam and withPageTitle only mention pages after the first", () => {
  assert.equal(withPageParam("/lang/ar", 1), "/lang/ar");
  assert.equal(withPageParam("/lang/ar", 3), "/lang/ar?page=3");
  assert.equal(withPageTitle("Arabic Entries", 1), "Arabic Entries");
  assert.equal(withPageTitle("Arabic Entries", 2), "Arabic Entries — Page 2");
});
