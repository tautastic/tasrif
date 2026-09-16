import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveVerbFormChoice, verbFormChoices } from "~/lib/validation/verbFormChoice";
import {
  affixMoodEnum,
  langTypeEnum,
  personTypeEnum,
  posTypeEnum,
  radicalKindEnum,
  senseRelationTypeEnum,
  shortVowelEnum,
  voiceTypeEnum,
} from "~/server/db/schema";
import { assertGolden, openDatabase } from "../harness";

const db = await openDatabase();

const enumLabels = (name: string): Promise<string[]> =>
  db.column<string>(
    `SELECT e.enumlabel::text
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typnamespace = 'public'::regnamespace AND t.typname = $1
     ORDER BY e.enumsortorder`,
    [name],
  );

const ENUM_PAIRS: [string, readonly string[]][] = [
  ["person_type", personTypeEnum.enumValues],
  ["affix_mood", affixMoodEnum.enumValues],
  ["radical_kind", radicalKindEnum.enumValues],
  ["short_vowel", shortVowelEnum.enumValues],
  ["voice_type", voiceTypeEnum.enumValues],
  ["lang_type", langTypeEnum.enumValues],
  ["pos_type", posTypeEnum.enumValues],
  ["sense_relation_type", senseRelationTypeEnum.enumValues],
];

for (const [typeName, declared] of ENUM_PAIRS) {
  test(`the ${typeName} enum matches its drizzle declaration`, async () => {
    assert.deepEqual(await enumLabels(typeName), [...declared]);
  });
}

test("every verb form choice offered by the UI resolves to a real pattern", async () => {
  const unresolved: string[] = [];
  for (const choice of verbFormChoices) {
    const { formNumber, perfectVowel, imperfectVowel } = resolveVerbFormChoice(choice);
    const resolved = await db.scalar<number | null>("SELECT resolve_morph_pattern_id($1, $2, $3, $4)", [
      "كتب",
      formNumber,
      perfectVowel,
      imperfectVowel,
    ]);
    if (resolved === null) {
      unresolved.push(choice);
    }
  }
  assert.deepEqual(unresolved, [], `verb form choices with no matching pattern for a sound root: ${unresolved}`);
});

test("the schema inventory matches its golden", async () => {
  const functions = await db.column<string>(
    `SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') -> ' ||
            pg_get_function_result(p.oid) || ' [' ||
            CASE p.provolatile WHEN 'i' THEN 'immutable' WHEN 's' THEN 'stable' ELSE 'volatile' END || ']'
     FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
     ORDER BY 1`,
  );
  const triggers = await db.column<string>(
    `SELECT pg_get_triggerdef(t.oid)
     FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
     WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
     ORDER BY 1`,
  );
  const enums = await db.column<string>(
    `SELECT t.typname || ': ' || string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typnamespace = 'public'::regnamespace
     GROUP BY t.typname
     ORDER BY 1`,
  );
  const composites = await db.column<string>(
    `SELECT t.typname || '(' ||
            string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), ', ' ORDER BY a.attnum) || ')'
     FROM pg_type t
     JOIN pg_class c ON c.oid = t.typrelid
     JOIN pg_attribute a ON a.attrelid = c.oid
     WHERE t.typnamespace = 'public'::regnamespace
       AND c.relkind = 'c'
       AND a.attnum > 0
       AND NOT a.attisdropped
     GROUP BY t.typname
     ORDER BY 1`,
  );
  const relations = await db.column<string>(
    `SELECT c.relkind::text || ' ' || c.relname
     FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'v', 'm')
     ORDER BY c.relname`,
  );

  const section = (title: string, lines: string[]) => [`## ${title} (${lines.length})`, ...lines, ""].join("\n");

  const inventory = [
    "# Schema inventory built from db/drizzle/*/migration.sql and db/*.sql",
    "#",
    "# This records what the repository builds, not what production happens to contain.",
    "# Adding or removing a function, trigger, enum, composite type or relation shows up",
    "# here as a reviewable diff; regenerate with UPDATE_GOLDENS=1.",
    "",
    section("relations", relations),
    section("enums", enums),
    section("composite types", composites),
    section("functions", functions),
    section("triggers", triggers),
  ].join("\n");

  await assertGolden("function-inventory.txt", inventory);
});
