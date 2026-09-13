import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "~/server/env";
import { relations } from "./relations";

const createDb = () => {
  const connectionString = `postgresql:///${encodeURIComponent(env.PGDATABASE)}?host=${encodeURIComponent(env.PGHOST)}`;
  return drizzle(connectionString, { relations });
};

const globalForDb = globalThis as { __db?: ReturnType<typeof createDb> };

const db = globalForDb.__db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__db = db;
}

export { db };
export type Db = typeof db;
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
