import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "drizzle-orm";
import { openRepository } from "./repository-db.ts";

await openRepository();
const { db } = await import("~/server/db");

test("an error on an idle pooled client is logged instead of crashing the process", () => {
  assert.ok(db.$client.listenerCount("error") > 0);
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    assert.doesNotThrow(() => db.$client.emit("error", new Error("connection reset by peer")));
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 1);
  assert.match(String(logged[0]?.[0]), /Unexpected error on idle PostgreSQL client/);
});

test("the pool is bounded and every connection carries statement and idle-transaction timeouts", async () => {
  assert.equal(db.$client.options.max, 10);
  assert.equal(db.$client.options.connectionTimeoutMillis, 5_000);
  assert.equal(db.$client.options.idleTimeoutMillis, 30_000);
  const result = await db.execute<{ statement_timeout: string; idle_in_transaction_session_timeout: string }>(
    sql`SELECT current_setting('statement_timeout') AS statement_timeout,
               current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout`,
  );
  assert.deepEqual(result.rows[0], { statement_timeout: "30s", idle_in_transaction_session_timeout: "1min" });
});
