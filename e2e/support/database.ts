import { randomBytes } from "node:crypto";
import { connect, type Db } from "../../tests/harness/client.ts";
import { createTestDatabase } from "../../tests/harness/database.ts";
import { resolveServer } from "../../tests/harness/docker.ts";
import type { DatabaseSettings } from "./state.ts";

const RENAME_ATTEMPTS = 20;
const RENAME_DELAY_MS = 100;
const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

const databasePrefix = (): string => {
  const prefix = process.env.E2E_DATABASE_PREFIX?.trim() || "tasrif_e2e";
  if (!IDENTIFIER.test(prefix)) {
    throw new Error(`E2E_DATABASE_PREFIX must be a lowercase identifier, received "${prefix}"`);
  }
  return prefix;
};

const connectAdmin = async (): Promise<Db> => {
  const server = await resolveServer();
  return connect({
    host: server.host,
    port: server.port,
    user: server.user,
    password: server.password,
    database: server.adminDatabase,
  });
};

const renameWhenIdle = async (from: string, to: string): Promise<void> => {
  const admin = await connectAdmin();
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < RENAME_ATTEMPTS; attempt += 1) {
      try {
        await admin.exec(`ALTER DATABASE ${from} RENAME TO ${to}`);
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, RENAME_DELAY_MS));
      }
    }
    throw new Error(`Could not rename ${from} to ${to}: ${String(lastError)}`);
  } finally {
    await admin.close();
  }
};

export const createE2eDatabase = async (): Promise<DatabaseSettings> => {
  const handle = await createTestDatabase();
  await handle.db.close();
  const name = `${databasePrefix()}_${Date.now()}_${randomBytes(4).toString("hex")}`;
  await renameWhenIdle(handle.name, name);
  return { ...handle.config, database: name };
};

export const dropE2eDatabase = async (database: string): Promise<void> => {
  if (!IDENTIFIER.test(database)) {
    throw new Error(`Refusing to drop a database with an unexpected name: ${database}`);
  }
  const admin = await connectAdmin();
  try {
    await admin.exec(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
  } finally {
    await admin.close();
  }
};

export const openDatabase = (settings: DatabaseSettings): Promise<Db> => connect(settings);
