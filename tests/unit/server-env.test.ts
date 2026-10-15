import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const REGISTER = join(ROOT, "tests", "harness", "register.ts");
const ENV_MODULE = join(ROOT, "src", "server", "env.ts");
const HEALTH_ROUTE = join(ROOT, "src", "app", "api", "health", "route.ts");

const VALID_ENV = {
  PGHOST: "localhost",
  PGUSER: "tasrif",
  PGDATABASE: "tasrif",
  AUTH_SECRET: "s".repeat(32),
  AUTH_PASSWORD: "p".repeat(12),
};

const importWith = (module: string, env: Record<string, string>) =>
  spawnSync(
    process.execPath,
    ["--import", REGISTER, "--input-type=module", "-e", `await import(${JSON.stringify(module)})`],
    { env: { ...env, PATH: process.env.PATH ?? "", NODE_ENV: "test" }, encoding: "utf8" },
  );

test("a complete environment loads", () => {
  assert.equal(importWith(ENV_MODULE, VALID_ENV).status, 0);
});

test("the boundary lengths of the secrets are accepted", () => {
  const result = importWith(ENV_MODULE, { ...VALID_ENV, AUTH_SECRET: "x".repeat(32), AUTH_PASSWORD: "y".repeat(12) });
  assert.equal(result.status, 0, result.stderr);
});

test("a missing database setting stops startup and names it", () => {
  for (const key of ["PGHOST", "PGUSER", "PGDATABASE"] as const) {
    const { [key]: _removed, ...rest } = VALID_ENV;
    const result = importWith(ENV_MODULE, rest);
    assert.notEqual(result.status, 0, key);
    assert.match(result.stderr, new RegExp(`${key} is required`), key);
  }
});

test("a short secret or password stops startup and says how long it must be", () => {
  const shortSecret = importWith(ENV_MODULE, { ...VALID_ENV, AUTH_SECRET: "s".repeat(31) });
  assert.notEqual(shortSecret.status, 0);
  assert.match(shortSecret.stderr, /AUTH_SECRET must be at least 32 characters/);

  const shortPassword = importWith(ENV_MODULE, { ...VALID_ENV, AUTH_PASSWORD: "p".repeat(11) });
  assert.notEqual(shortPassword.status, 0);
  assert.match(shortPassword.stderr, /AUTH_PASSWORD must be at least 12 characters/);
});

test("every problem is reported in one message", () => {
  const result = importWith(ENV_MODULE, { PGHOST: "localhost", AUTH_SECRET: "short", AUTH_PASSWORD: "short" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid environment configuration/);
  for (const expected of [
    "PGUSER is required",
    "PGDATABASE is required",
    "AUTH_SECRET must be",
    "AUTH_PASSWORD must be",
  ]) {
    assert.match(result.stderr, new RegExp(expected));
  }
});

test("the health route cannot load with an invalid environment", () => {
  assert.equal(importWith(HEALTH_ROUTE, { ...VALID_ENV, AUTH_SECRET: "short" }).status !== 0, true);
});
