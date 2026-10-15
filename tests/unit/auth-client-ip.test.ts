import assert from "node:assert/strict";
import { test } from "node:test";
import { getClientIp } from "~/server/auth/client-ip";

const headersOf = (entries: Record<string, string>) => new Headers(entries);

test("prefers x-real-ip over x-forwarded-for", () => {
  assert.equal(
    getClientIp(headersOf({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" })),
    "203.0.113.7",
  );
});

test("uses the last x-forwarded-for entry, which is the one the proxy appended", () => {
  assert.equal(getClientIp(headersOf({ "x-forwarded-for": "10.9.9.9, 192.0.2.44, 203.0.113.7" })), "203.0.113.7");
});

test("ignores a spoofed leading x-forwarded-for entry", () => {
  const first = getClientIp(headersOf({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" }));
  const second = getClientIp(headersOf({ "x-forwarded-for": "2.2.2.2, 203.0.113.7" }));
  assert.equal(first, second);
});

test("trims whitespace around entries", () => {
  assert.equal(getClientIp(headersOf({ "x-forwarded-for": "198.51.100.1 ,  203.0.113.7  " })), "203.0.113.7");
  assert.equal(getClientIp(headersOf({ "x-real-ip": "  203.0.113.7 " })), "203.0.113.7");
});

test("accepts IPv6 addresses", () => {
  assert.equal(getClientIp(headersOf({ "x-real-ip": "2001:db8::1" })), "2001:db8::1");
  assert.equal(getClientIp(headersOf({ "x-forwarded-for": "198.51.100.1, 2001:db8::2" })), "2001:db8::2");
});

test("falls back to x-forwarded-for when x-real-ip is not an address", () => {
  assert.equal(getClientIp(headersOf({ "x-real-ip": "not-an-ip", "x-forwarded-for": "203.0.113.7" })), "203.0.113.7");
});

test("returns unknown when no usable address is present", () => {
  assert.equal(getClientIp(headersOf({})), "unknown");
  assert.equal(getClientIp(headersOf({ "x-forwarded-for": "garbage, ???" })), "unknown");
  assert.equal(getClientIp(headersOf({ "x-forwarded-for": "" })), "unknown");
});
