import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "~/server/env";
import { relations } from "./relations";

const POOL_MAX_CONNECTIONS = 10;
const CONNECTION_TIMEOUT_MS = 5_000;
const IDLE_TIMEOUT_MS = 30_000;
const STATEMENT_TIMEOUT_MS = 30_000;
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 60_000;

const createDb = () => {
  const connectionString = `postgresql:///${encodeURIComponent(env.PGDATABASE)}?host=${encodeURIComponent(env.PGHOST)}`;
  const database = drizzle({
    connection: {
      connectionString,
      max: POOL_MAX_CONNECTIONS,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: IDLE_TIMEOUT_MS,
      statement_timeout: STATEMENT_TIMEOUT_MS,
      idle_in_transaction_session_timeout: IDLE_IN_TRANSACTION_TIMEOUT_MS,
    },
    relations,
  });
  database.$client.on("error", (error) => {
    console.error("Unexpected error on idle PostgreSQL client", error);
  });
  return database;
};

const globalForDb = globalThis as { __db?: ReturnType<typeof createDb> };

const db = globalForDb.__db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__db = db;
}

export { db };
export type Db = typeof db;
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
