import assert from "node:assert/strict";
import { test } from "node:test";
import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "~/server/db/schema";
import { openDatabase } from "../harness";

const db = await openDatabase();

const declaredTables: ReturnType<typeof getTableConfig>[] = [];
for (const value of Object.values(schema)) {
  if (is(value, PgTable)) {
    declaredTables.push(getTableConfig(value));
  }
}
declaredTables.sort((a, b) => a.name.localeCompare(b.name));

const names = (values: (string | undefined)[]): string[] =>
  values.filter((value): value is string => value !== undefined).sort();

const storedColumns = async (table: string): Promise<string[]> =>
  db.column<string>(
    `SELECT attname || ' ' || CASE WHEN attnotnull THEN 'not null' ELSE 'null' END
     FROM pg_attribute
     WHERE attrelid = ('public.' || quote_ident($1))::regclass AND attnum > 0 AND NOT attisdropped
     ORDER BY attname`,
    [table],
  );

const storedConstraints = async (table: string, kind: string): Promise<string[]> =>
  db.column<string>(
    `SELECT conname::text
     FROM pg_constraint
     WHERE conrelid = ('public.' || quote_ident($1))::regclass AND contype = $2
     ORDER BY conname`,
    [table, kind],
  );

const storedForeignKeys = async (table: string): Promise<string[]> =>
  db.column<string>(
    `SELECT (SELECT string_agg(a.attname, ',' ORDER BY k.position)
              FROM unnest(c.conkey) WITH ORDINALITY k(attnum, position)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
            || ' -> ' || (SELECT relname FROM pg_class WHERE oid = c.confrelid)
     FROM pg_constraint c
     WHERE c.conrelid = ('public.' || quote_ident($1))::regclass AND c.contype = 'f'
     ORDER BY 1`,
    [table],
  );

const storedIndexes = async (table: string): Promise<string[]> =>
  db.column<string>(
    `SELECT i.indexname::text
     FROM pg_indexes i
     WHERE i.schemaname = 'public' AND i.tablename = $1
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint c
         WHERE c.conrelid = ('public.' || quote_ident($1))::regclass AND c.conname = i.indexname
       )
     ORDER BY i.indexname`,
    [table],
  );

test("db/schema.sql creates exactly the tables the drizzle schema declares", async () => {
  const stored = await db.column<string>(
    "SELECT tablename::text FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  assert.deepEqual(
    stored,
    declaredTables.map((table) => table.name),
  );
});

for (const table of declaredTables) {
  test(`${table.name}: columns and nullability match the drizzle declaration`, async () => {
    const declared = table.columns.map((column) => `${column.name} ${column.notNull ? "not null" : "null"}`).sort();
    assert.deepEqual(await storedColumns(table.name), declared);
  });

  test(`${table.name}: primary key, unique, foreign key and check constraints match the drizzle declaration`, async () => {
    const primaryKeys = table.columns.filter((column) => column.primary).length + table.primaryKeys.length;
    assert.equal((await storedConstraints(table.name, "p")).length, primaryKeys);
    assert.deepEqual(
      await storedConstraints(table.name, "u"),
      names(table.uniqueConstraints.map((constraint) => constraint.name)),
    );
    assert.deepEqual(
      await storedForeignKeys(table.name),
      table.foreignKeys
        .map((foreignKey) => {
          const { columns, foreignTable } = foreignKey.reference();
          return `${columns.map((column) => column.name).join(",")} -> ${getTableName(foreignTable)}`;
        })
        .sort(),
    );
    assert.deepEqual(await storedConstraints(table.name, "c"), names(table.checks.map((check) => check.name)));
  });

  test(`${table.name}: standalone indexes match the drizzle declaration`, async () => {
    assert.deepEqual(
      await storedIndexes(table.name),
      names(table.indexes.map((index) => index.config.name)).filter((name) => !name.endsWith("_pkey")),
    );
  });
}
