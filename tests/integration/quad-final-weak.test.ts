import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSqlState, type Db, openDatabase } from "../harness";

const db = await openDatabase();

const resolvedCode = (scope: Db, root: string, form: number): Promise<string | null> =>
  scope
    .maybeOne<{ code: string }>(
      `SELECT mp.code
       FROM morph_pattern mp
       WHERE mp.id = resolve_morph_pattern_id($1, $2::int, $3::short_vowel, $4::short_vowel, 4)`,
      [root, form, form === 1 ? "a" : null, form === 1 ? "i" : null],
    )
    .then((row) => row?.code ?? null);

const insertQuadPattern = (scope: Db, code: string, form: number, fourthKind: string): Promise<number> =>
  scope.scalar<number>(
    `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules,
                                radical4_kind)
     VALUES ($1, $2, 4, 'x', $3, '{"perfect": "{1}{2}{3}{4}"}'::jsonb, $4::radical_kind)
     RETURNING id`,
    [code, form, `test only ${code}`, fourthKind],
  );

test("only the final-weak pattern of form IIIq has a weak fourth radical", async () => {
  const weak = await db.rows<{ code: string; radical4_kind: string }>(
    "SELECT code, radical4_kind::text FROM morph_pattern WHERE radical4_kind <> 'sound' ORDER BY code",
  );
  assert.deepEqual(weak, [{ code: "f3-quadriliteral-final-weak", radical4_kind: "ya" }]);
  const weakRows = await db.scalar<number>(
    "SELECT count(*)::int FROM morph_pattern_resolution WHERE radical4_kind <> 'sound'",
  );
  assert.equal(weakRows, 1);
  assert.equal(
    await db.scalar<number>(
      "SELECT count(*)::int FROM morph_pattern WHERE radical_count = 3 AND radical4_kind <> 'sound'",
    ),
    0,
  );
});

test("the fourth radical kind is sound, waw or ya, and only a quadriliteral pattern may have a weak one", async () => {
  await db.tx(async (tx) => {
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules,
                                    radical4_kind)
         VALUES ('f2-test-only-hamza', 2, 4, 'x', 'test only hamza', '{"perfect": "{4}"}'::jsonb, 'hamza')`,
      ),
      "23514",
      /chk_morph_pattern_radical4_kind/,
    );
  });
  await db.tx(async (tx) => {
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules,
                                    is_lexical, perfect_vowel, imperfect_vowel, radical4_kind)
         VALUES ('f1-test-only-weak-triliteral', 1, 3, 'x', 'test only weak triliteral', '{"perfect": "{1}"}'::jsonb,
                 TRUE, 'u', 'i', 'ya')`,
      ),
      "23514",
      /chk_morph_pattern_radical4_kind/,
    );
  });
});

test("the shape check still refuses a weak letter before the last radical of a quadriliteral pattern", async () => {
  await db.tx(async (tx) => {
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules,
                                    radical3_kind)
         VALUES ('f2-test-only-weak-third', 2, 4, 'x', 'test only weak third', '{"perfect": "{4}"}'::jsonb, 'ya')`,
      ),
      "23514",
      /chk_morph_pattern_quadriliteral_shape/,
    );
  });
});

test("a weak fourth radical is a shape of its own: patterns of other fourth radicals coexist, equal ones do not", async () => {
  await db.tx(async (tx) => {
    const weakId = await insertQuadPattern(tx, "f2-test-only-ya-fourth", 2, "ya");
    const rows = await tx.rows<{ radical4_kind: string; radical_count: number }>(
      "SELECT radical4_kind::text, radical_count FROM morph_pattern_resolution WHERE morph_pattern_id = $1",
      [weakId],
    );
    assert.deepEqual(rows, [{ radical4_kind: "ya", radical_count: 4 }]);
    assert.equal(await resolvedCode(tx, "سلقي", 2), "f2-test-only-ya-fourth");
    assert.equal(await resolvedCode(tx, "دحرج", 2), "f2-quadriliteral");
  });
  await db.tx(async (tx) => {
    await insertQuadPattern(tx, "f2-test-only-ya-first", 2, "ya");
    assertSqlState(
      await tx.failure(
        `INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules,
                                    radical4_kind)
         VALUES ('f2-test-only-ya-second', 2, 4, 'x', 'test only second ya', '{"perfect": "{4}"}'::jsonb, 'ya')`,
      ),
      "23505",
      /unique_morph_pattern_resolution_key/,
    );
  });
});

test("changing the fourth radical kind of a pattern moves its own resolution row", async () => {
  await db.tx(async (tx) => {
    const id = await insertQuadPattern(tx, "f2-test-only-moving-fourth", 2, "ya");
    assert.equal(await resolvedCode(tx, "سلقي", 2), "f2-test-only-moving-fourth");
    await tx.exec("UPDATE morph_pattern SET radical4_kind = 'waw' WHERE id = $1", [id]);
    assert.equal(await resolvedCode(tx, "سلقي", 2), null);
    assert.equal(await resolvedCode(tx, "سلقو", 2), "f2-test-only-moving-fourth");
    assert.equal(
      await tx.scalar<number>("SELECT count(*)::int FROM morph_pattern_resolution WHERE morph_pattern_id = $1", [id]),
      1,
    );
  });
});

test("a four-letter root with a final ya resolves to the final-weak pattern in form IIIq and to nothing elsewhere", async () => {
  for (const root of ["سلقي", "سردي", "غردي", "غلثي", "سلقى"]) {
    assert.equal(await resolvedCode(db, root, 3), "f3-quadriliteral-final-weak", root);
    for (const form of [1, 2, 4]) {
      assert.equal(await resolvedCode(db, root, form), null, `${root} form ${form}`);
    }
  }
});

test("a final waw is not guessed: no pattern has a table for it", async () => {
  for (const form of [1, 2, 3, 4]) {
    assert.equal(await resolvedCode(db, "سلقو", form), null, `form ${form}`);
  }
});

test("sound four-letter roots resolve as before, whatever their weak letters", async () => {
  for (const root of ["دحرج", "زلزل", "سيطر", "هرول", "وسوس", "طمأن", "جلبب"]) {
    assert.equal(await resolvedCode(db, root, 3), "f3-quadriliteral", root);
  }
  assert.equal(await resolvedCode(db, "حرجم", 3), "f3-quadriliteral");
});

test("add_morph_pattern_resolution registers the shape of the example root and refuses one that is taken", async () => {
  assertSqlState(
    await db.failure("SELECT add_morph_pattern_resolution($1, $2)", ["f3-quadriliteral", "سلقي"]),
    "23505",
    /already resolves to pattern f3-quadriliteral-final-weak/,
  );
  assertSqlState(
    await db.failure("SELECT add_morph_pattern_resolution($1, $2)", ["f3-quadriliteral-final-weak", "دحرج"]),
    "23505",
    /already resolves to pattern f3-quadriliteral/,
  );
  await db.tx(async (tx) => {
    const own = await tx.scalar<number>(
      "SELECT id FROM morph_pattern_resolution WHERE morph_pattern_id = morph_pattern_id_for_code($1)",
      ["f3-quadriliteral-final-weak"],
    );
    assert.equal(
      await tx.scalar<number>("SELECT add_morph_pattern_resolution($1, $2)", ["f3-quadriliteral-final-weak", "سلقي"]),
      own,
    );
  });
  await db.tx(async (tx) => {
    await insertQuadPattern(tx, "f2-test-only-two-shapes", 2, "ya");
    const own = await tx.scalar<number>(
      "SELECT id FROM morph_pattern_resolution WHERE morph_pattern_id = morph_pattern_id_for_code($1)",
      ["f2-test-only-two-shapes"],
    );
    const second = await tx.scalar<number>("SELECT add_morph_pattern_resolution($1, $2)", [
      "f2-test-only-two-shapes",
      "سلقو",
    ]);
    assert.notEqual(second, own);
    assert.equal(await resolvedCode(tx, "سلقي", 2), "f2-test-only-two-shapes");
    assert.equal(await resolvedCode(tx, "سلقو", 2), "f2-test-only-two-shapes");
    assert.equal(await resolvedCode(tx, "سلقو", 3), null);
  });
});

test("a final-weak root reaches its pattern through the verb form picker's describe function", async () => {
  const labels = await db.scalar<string[]>("SELECT describe_quadriliteral_root($1)", ["سلقي"]);
  assert.deepEqual([...labels].sort(), ["final-weak", "quadriliteral"]);
});

test("a hamza as the last radical is a sound letter for the resolver, in every spelling of the hamza", async () => {
  for (const root of ["دحرأ", "دحرء", "دحرئ", "دحرإ"]) {
    for (const form of [1, 2, 3, 4]) {
      const expected = ["f1-a-i-quadriliteral", "f2-quadriliteral", "f3-quadriliteral", "f4-quadriliteral"][form - 1];
      assert.equal(await resolvedCode(db, root, form), expected, `${root} form ${form}`);
    }
    const labels = await db.scalar<string[]>("SELECT describe_quadriliteral_root($1)", [root]);
    assert.deepEqual([...labels].sort(), ["hamzated", "quadriliteral"], root);
  }
});
