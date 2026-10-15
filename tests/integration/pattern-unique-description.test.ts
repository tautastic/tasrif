import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSqlState, type Db, openDatabase } from "../harness";

const db = await openDatabase();

const DESCRIPTION = "test only shared description";

const insertLexicalPattern = (scope: Db, code: string, radicalCount: 3 | 4, description = DESCRIPTION) =>
  scope.scalar<number>(
    `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, is_lexical)
     VALUES ($1, 2, $2, 'x', $3, $4::jsonb, TRUE)
     RETURNING id`,
    [code, radicalCount, description, JSON.stringify({ perfect: radicalCount === 4 ? "{1}{2}{3}{4}" : "{1}{2}{3}" })],
  );

test("a triliteral and a quadriliteral pattern may share a form number and a description", async () => {
  await db.tx(async (tx) => {
    await insertLexicalPattern(tx, "f2-test-only-shared-tri", 3);
    await insertLexicalPattern(tx, "f2-test-only-shared-quad", 4);

    assert.equal(
      await tx.scalar<number>("SELECT count(*)::int FROM morph_pattern WHERE form_number = 2 AND description = $1", [
        DESCRIPTION,
      ]),
      2,
    );
  });
});

test("two triliteral patterns of one form still cannot share a description", async () => {
  await db.tx(async (tx) => {
    await insertLexicalPattern(tx, "f2-test-only-first-tri", 3);
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, is_lexical)
         VALUES ('f2-test-only-second-tri', 2, 3, 'x', $1, '{"perfect": "{1}"}'::jsonb, TRUE)`,
        [DESCRIPTION],
      ),
      "23505",
      /unique_form_number_description/,
    );
  });
});

test("two quadriliteral patterns of one form still cannot share a description", async () => {
  await db.tx(async (tx) => {
    await insertLexicalPattern(tx, "f2-test-only-first-quad", 4);
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, is_lexical)
         VALUES ('f2-test-only-second-quad', 2, 4, 'x', $1, '{"perfect": "{4}"}'::jsonb, TRUE)`,
        [DESCRIPTION],
      ),
      "23505",
      /unique_form_number_description/,
    );
  });
});
