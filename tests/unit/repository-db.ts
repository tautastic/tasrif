import { after } from "node:test";
import { createTestDatabase } from "../harness";

export const openRepository = async () => {
  const handle = await createTestDatabase();
  const { config } = handle;
  process.env.PGHOST = config.host;
  process.env.PGPORT = String(config.port);
  process.env.PGUSER = config.user;
  process.env.PGDATABASE = config.database;
  process.env.AUTH_SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
  process.env.AUTH_PASSWORD = "test-password-0123456789";
  if (config.password) {
    process.env.PGPASSWORD = config.password;
  }

  const { db } = await import("~/server/db");
  const entries = await import("~/server/db/repository/lexical-entry");
  const senses = await import("~/server/db/repository/sense");
  const pgError = await import("~/server/db/pg-error");
  const patterns = await import("~/server/db/repository/morph-pattern");
  const overrides = await import("~/server/db/repository/lexical-pattern-override");
  after(async () => {
    await db.$client.end();
    await handle.drop();
  });

  return { sql: handle.db, entries, senses, pgError, patterns, overrides };
};

export interface FixtureEntry {
  entryId: number;
  senseId: number;
}

export const insertEntryWithSense = async (
  sql: Awaited<ReturnType<typeof openRepository>>["sql"],
  input: { language: "ar" | "en"; text: string; root?: string | null; pos?: string; isVerified?: boolean },
): Promise<FixtureEntry> => {
  const entryId = await sql.scalar<number>(
    "INSERT INTO lexical_entry (language, text, root, is_verified) VALUES ($1, $2, $3, $4) RETURNING id",
    [input.language, input.text, input.root ?? null, input.isVerified ?? true],
  );
  const senseId = await sql.scalar<number>(
    "INSERT INTO sense (lexical_entry_id, pos, sense_number, definitions) VALUES ($1, $2::pos_type, 1, ARRAY[$3]) RETURNING id",
    [entryId, input.pos ?? "noun", input.text],
  );
  return { entryId, senseId };
};
