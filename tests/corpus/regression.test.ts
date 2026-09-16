import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { after, test } from "node:test";
import { promisify } from "node:util";
import { compareArabic, createTestDatabase, type TestDatabase } from "../harness";

const execFileAsync = promisify(execFile);

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const BACKUP_DIR = join(REPO_ROOT, "backups");
const MAX_REPORTED = 20;

const REPLAYED_TABLES = ["affix_rules", "morph_pattern", "lexical_entry", "conjugation"];

const DATA_TABLES = [
  "conjugation",
  "sense_relation",
  "translation_link",
  "sense",
  "lexical_entry",
  "morph_pattern",
  "affix_rules",
];

const findDump = async (): Promise<string | null> => {
  const explicit = process.env.CORPUS_DUMP;
  if (explicit) {
    return explicit;
  }
  try {
    const names = (await readdir(BACKUP_DIR)).filter((name) => name.endsWith(".dump"));
    const dated = await Promise.all(
      names.map(async (name) => {
        const path = join(BACKUP_DIR, name);
        return { path, modified: (await stat(path)).mtimeMs };
      }),
    );
    dated.sort((a, b) => a.modified - b.modified);
    return dated.at(-1)?.path ?? null;
  } catch {
    return null;
  }
};

const enabled = process.env.CORPUS === "1";
const dumpPath = enabled ? await findDump() : null;

if (!enabled) {
  test("corpus regression is opt in", { skip: "set CORPUS=1 to replay a production dump" }, () => {});
} else if (dumpPath === null) {
  test("corpus regression needs a dump", { skip: `no .dump found in ${BACKUP_DIR}; set CORPUS_DUMP` }, () => {});
} else {
  const handle: TestDatabase = await createTestDatabase();
  after(() => handle.drop());
  const { db, config } = handle;

  await db.exec(`TRUNCATE TABLE ${DATA_TABLES.join(", ")} RESTART IDENTITY CASCADE`);

  const restore = async (): Promise<void> => {
    const args = [
      "--data-only",
      "--disable-triggers",
      "--no-owner",
      "--no-privileges",
      ...REPLAYED_TABLES.flatMap((table) => ["--table", table]),
      "--host",
      config.host,
      "--port",
      String(config.port),
      "--username",
      config.user,
      "--dbname",
      config.database,
      dumpPath,
    ];
    let stderr = "";
    try {
      await execFileAsync("pg_restore", args, {
        env: { ...process.env, PGPASSWORD: config.password ?? "" },
        maxBuffer: 256 * 1024 * 1024,
      });
    } catch (error) {
      stderr = (error as { stderr?: string }).stderr ?? String(error);
    }
    const restored = Number(await db.scalar<string>("SELECT count(*)::text FROM lexical_entry"));
    if (restored === 0) {
      throw new Error(
        `pg_restore recovered no lexical entries from ${dumpPath}. If the dump predates the current ` +
          `migrations its columns will not line up with the schema under test.\n${stderr}`,
      );
    }
    if (stderr) {
      console.log(`pg_restore reported non-fatal errors while restoring ${dumpPath}`);
    }
  };

  await restore();

  for (const table of REPLAYED_TABLES) {
    await db.exec(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT max(id) FROM ${table}), 1))`, [
      table,
    ]);
  }

  await db.exec(
    `CREATE TEMP TABLE stored_stems AS
     SELECT id, text, root, morph_pattern_id, masdar, active_participle, passive_participle FROM lexical_entry`,
  );
  await db.exec(
    "CREATE TEMP TABLE stored_conjugation AS SELECT lexical_entry_id, voice, mood, person, form FROM conjugation",
  );

  test("the dump carries a corpus worth replaying", async () => {
    const entries = Number(await db.scalar<string>("SELECT count(*)::text FROM stored_stems"));
    const withPattern = Number(
      await db.scalar<string>("SELECT count(*)::text FROM stored_stems WHERE morph_pattern_id IS NOT NULL"),
    );
    const cells = Number(await db.scalar<string>("SELECT count(*)::text FROM stored_conjugation"));
    assert.ok(entries > 0, "the restored dump contained no lexical entries");
    console.log(`corpus: ${entries} entries (${withPattern} with a pattern), ${cells} conjugation cells`);
  });

  await db.exec("SELECT regenerate_all_derived_stems()");

  test("regenerating every entry reproduces the stored stems", async () => {
    const differences = await db.rows<{
      id: number;
      text: string;
      root: string | null;
      field: string;
      stored: string | null;
      regenerated: string | null;
    }>(
      `SELECT s.id, s.text, s.root, f.field, f.stored, f.regenerated
       FROM stored_stems s
       JOIN lexical_entry le ON le.id = s.id
       CROSS JOIN LATERAL (
         VALUES ('masdar', s.masdar, le.masdar),
                ('active_participle', s.active_participle, le.active_participle),
                ('passive_participle', s.passive_participle, le.passive_participle)
       ) AS f(field, stored, regenerated)
       WHERE f.stored IS DISTINCT FROM f.regenerated
       ORDER BY s.id, f.field`,
    );
    const report = differences
      .slice(0, MAX_REPORTED)
      .map(
        (row) =>
          `entry ${row.id} ${row.text} (root ${row.root}) ${row.field}\n${compareArabic(row.regenerated, row.stored)}`,
      )
      .join("\n\n");
    assert.equal(differences.length, 0, `${differences.length} stem(s) changed against the stored corpus\n\n${report}`);
  });

  test("regenerating every entry reproduces the stored conjugations", async () => {
    const differences = await db.rows<{
      lexical_entry_id: number;
      mood: string;
      person: string;
      stored: string | null;
      regenerated: string | null;
    }>(
      `SELECT COALESCE(s.lexical_entry_id, c.lexical_entry_id) AS lexical_entry_id,
              COALESCE(s.mood, c.mood)::text AS mood,
              COALESCE(s.person, c.person)::text AS person,
              s.form AS stored,
              c.form AS regenerated
       FROM stored_conjugation s
       FULL OUTER JOIN conjugation c
         ON c.lexical_entry_id = s.lexical_entry_id
        AND c.voice = s.voice
        AND c.mood = s.mood
        AND c.person = s.person
       WHERE s.form IS DISTINCT FROM c.form
       ORDER BY 1, 2, 3`,
    );
    const report = differences
      .slice(0, MAX_REPORTED)
      .map(
        (row) =>
          `entry ${row.lexical_entry_id} ${row.mood}/${row.person}\n${compareArabic(row.regenerated, row.stored)}`,
      )
      .join("\n\n");
    assert.equal(
      differences.length,
      0,
      `${differences.length} conjugation cell(s) changed against the stored corpus\n\n${report}`,
    );
  });
}
