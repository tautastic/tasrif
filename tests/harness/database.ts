import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { connect, type Db } from "./client.ts";
import { readyTimeoutMs, resolveServer, type ServerConfig } from "./docker.ts";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const DB_DIR = join(REPO_ROOT, "db");
const STALE_DATABASE_AGE_MS = 60 * 60 * 1000;

export interface SqlSource {
  path: string;
  sql: string;
}

const sortedNames = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.map((entry) => entry.name).sort();
};

export const collectSqlSources = async (): Promise<SqlSource[]> => {
  const paths: string[] = [];
  for (const dir of await sortedNames(join(DB_DIR, "drizzle"))) {
    paths.push(join(DB_DIR, "drizzle", dir, "migration.sql"));
  }
  for (const name of await sortedNames(DB_DIR)) {
    if (name.endsWith(".sql")) {
      paths.push(join(DB_DIR, name));
    }
  }
  const sources: SqlSource[] = [];
  for (const path of paths) {
    sources.push({ path: relative(REPO_ROOT, path), sql: await readFile(path, "utf8") });
  }
  return sources;
};

const fingerprint = (sources: SqlSource[]): string => {
  const hash = createHash("sha256");
  for (const source of sources) {
    hash.update(source.path);
    hash.update(source.sql);
  }
  return hash.digest("hex").slice(0, 12);
};

const connectAdmin = (server: ServerConfig): Promise<Db> =>
  connect({
    host: server.host,
    port: server.port,
    user: server.user,
    password: server.password,
    database: server.adminDatabase,
  });

const waitForServer = async (server: ServerConfig): Promise<Db> => {
  const deadline = Date.now() + readyTimeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await connectAdmin(server);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`The test database never became ready: ${String(lastError)}`);
};

const loadSchema = async (db: Db, sources: SqlSource[]): Promise<void> => {
  await db.exec("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  for (const source of sources) {
    try {
      await db.exec(source.sql);
    } catch (error) {
      throw new Error(`Failed while loading ${source.path}: ${String(error)}`);
    }
  }
};

const dropStaleDatabases = async (admin: Db): Promise<void> => {
  const cutoff = Date.now() - STALE_DATABASE_AGE_MS;
  const names = await admin.column<string>(
    "SELECT datname FROM pg_database WHERE datname ~ '^tasrif_t_[0-9]+_[a-z0-9]+$'",
  );
  for (const name of names) {
    const stamp = Number(name.split("_")[2]);
    if (!Number.isInteger(stamp) || stamp > cutoff) {
      continue;
    }
    try {
      await admin.exec(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    } catch {}
  }
};

const ensureTemplate = async (server: ServerConfig, admin: Db, sources: SqlSource[]): Promise<string> => {
  const template = `tasrif_tpl_${fingerprint(sources)}`;
  const building = `${template}_build`;
  await admin.exec("SELECT pg_advisory_lock(hashtext($1))", [template]);
  try {
    const exists = await admin.scalar<boolean>("SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)", [
      template,
    ]);
    if (exists) {
      return template;
    }
    await admin.exec(`DROP DATABASE IF EXISTS ${building} WITH (FORCE)`);
    await admin.exec(`CREATE DATABASE ${building}`);
    const builder = await connect({
      host: server.host,
      port: server.port,
      user: server.user,
      password: server.password,
      database: building,
    });
    try {
      await loadSchema(builder, sources);
    } finally {
      await builder.close();
    }
    await admin.exec(`ALTER DATABASE ${building} RENAME TO ${template}`);
    return template;
  } finally {
    await admin.exec("SELECT pg_advisory_unlock(hashtext($1))", [template]);
  }
};

export interface TestDatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string | undefined;
  database: string;
}

export interface TestDatabase {
  db: Db;
  name: string;
  config: TestDatabaseConfig;
  drop: () => Promise<void>;
}

export const createTestDatabase = async (): Promise<TestDatabase> => {
  const server = await resolveServer();
  const admin = await waitForServer(server);
  let name: string;
  try {
    const sources = await collectSqlSources();
    await dropStaleDatabases(admin);
    const template = await ensureTemplate(server, admin, sources);
    name = `tasrif_t_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await admin.exec(`CREATE DATABASE ${name} TEMPLATE ${template}`);
  } finally {
    await admin.close();
  }
  const config: TestDatabaseConfig = {
    host: server.host,
    port: server.port,
    user: server.user,
    password: server.password,
    database: name,
  };
  const db = await connect(config);
  return {
    db,
    name,
    config,
    drop: async () => {
      await db.close();
      const cleaner = await connectAdmin(server);
      try {
        await cleaner.exec(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await cleaner.close();
      }
    },
  };
};
