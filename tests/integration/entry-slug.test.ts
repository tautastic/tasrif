import assert from "node:assert/strict";
import { test } from "node:test";
import { type Db, openDatabase } from "../harness";
import { SLUG_CASES } from "../unit/slug-cases.ts";

const db = await openDatabase();

type Language = "ar" | "en";

const addEntry = (
  scope: Db,
  text: string,
  options: { language?: Language; verified?: boolean } = {},
): Promise<number> =>
  scope.scalar<number>("INSERT INTO lexical_entry (language, text, is_verified) VALUES ($1, $2, $3) RETURNING id", [
    options.language ?? "en",
    text,
    options.verified ?? true,
  ]);

const slugOf = (scope: Db, id: number): Promise<string> =>
  scope.scalar<string>("SELECT slug FROM lexical_entry WHERE id = $1", [id]);

const slugsOf = async (scope: Db, inputs: readonly string[]): Promise<string[]> => {
  const rows = await scope.rows<{ slug: string }>(
    `SELECT entry_slug(value) AS slug
     FROM jsonb_array_elements_text($1::jsonb) WITH ORDINALITY AS input(value, position)
     ORDER BY position`,
    [JSON.stringify(inputs)],
  );
  return rows.map((row) => row.slug);
};

const redirects = (scope: Db): Promise<{ old_slug: string; lexical_entry_id: number }[]> =>
  scope.rows("SELECT old_slug, lexical_entry_id FROM entry_slug_redirect ORDER BY old_slug");

const resolve = (scope: Db, key: string): Promise<string | null> =>
  scope.scalar<string | null>("SELECT resolve_entry_slug_redirect($1)", [key]);

test("entry_slug gives the documented slug for every rule", async () => {
  const slugs = await slugsOf(
    db,
    SLUG_CASES.map((entry) => entry.input),
  );
  SLUG_CASES.forEach((entry, index) => {
    assert.equal(slugs[index], entry.slug, entry.name);
  });
});

test("entry_slug is idempotent on every documented case", async () => {
  const slugs = await slugsOf(
    db,
    SLUG_CASES.map((entry) => entry.input),
  );
  assert.deepEqual(await slugsOf(db, slugs), slugs);
});

test("entry_slug of NULL is NULL and the function is immutable", async () => {
  assert.equal(await db.scalar<string | null>("SELECT entry_slug(NULL)"), null);
  assert.equal(await db.scalar<string>("SELECT provolatile::text FROM pg_proc WHERE proname = 'entry_slug'"), "i");
  assert.equal(
    await db.scalar<string>("SELECT provolatile::text FROM pg_proc WHERE proname = 'lexical_entry_slug'"),
    "i",
  );
});

test("lexical_entry_slug falls back to the id when nothing is left of the text", async () => {
  assert.equal(await db.scalar<string>("SELECT lexical_entry_slug(7, '???')"), "e-7");
  assert.equal(await db.scalar<string>("SELECT lexical_entry_slug(7, 'to write')"), "to-write");
});

test("inserting an entry stores its slug, and an explicit slug is ignored", async () => {
  await db.tx(async (tx) => {
    const id = await addEntry(tx, "To Write");
    assert.equal(await slugOf(tx, id), "to-write");

    const explicit = await tx.scalar<string>(
      "INSERT INTO lexical_entry (language, text, slug) VALUES ('en', 'Some Phrase', 'chosen-by-hand') RETURNING slug",
    );
    assert.equal(explicit, "some-phrase");

    const nulled = await tx.scalar<string>(
      "INSERT INTO lexical_entry (language, text, slug) VALUES ('en', 'Other Phrase', NULL) RETURNING slug",
    );
    assert.equal(nulled, "other-phrase");
  });
});

test("an entry with only punctuation is addressed by its id", async () => {
  await db.tx(async (tx) => {
    const id = await addEntry(tx, "???");
    assert.equal(await slugOf(tx, id), `e-${id}`);
    assert.equal(await tx.scalar<string>("SELECT normalized_text FROM lexical_entry WHERE id = $1", [id]), "");
  });
});

test("editing the text updates the slug, other edits leave it alone and writing the slug directly is undone", async () => {
  await db.tx(async (tx) => {
    const id = await addEntry(tx, "to write");
    await tx.exec("UPDATE lexical_entry SET text = 'to write down' WHERE id = $1", [id]);
    assert.equal(await slugOf(tx, id), "to-write-down");

    await tx.exec("UPDATE lexical_entry SET is_verified = false WHERE id = $1", [id]);
    assert.equal(await slugOf(tx, id), "to-write-down");

    await tx.exec("UPDATE lexical_entry SET slug = 'forced' WHERE id = $1", [id]);
    assert.equal(await slugOf(tx, id), "to-write-down");

    await tx.exec("UPDATE lexical_entry SET slug = NULL WHERE id = $1", [id]);
    assert.equal(await slugOf(tx, id), "to-write-down");
  });
});

test("entries whose text differs only by diacritics or letter variants share one slug", async () => {
  await db.tx(async (tx) => {
    const first = await addEntry(tx, "كِتَاب", { language: "ar" });
    const second = await addEntry(tx, "كُتَّاب", { language: "ar" });
    const wasla = await addEntry(tx, `${String.fromCodePoint(0x0671)}بْن`, { language: "ar" });
    const alef = await addEntry(tx, "ابن", { language: "ar" });
    assert.equal(await slugOf(tx, first), await slugOf(tx, second));
    assert.equal(await slugOf(tx, wasla), await slugOf(tx, alef));
  });
});

test("the slug column is NOT NULL, has a btree index and answers an equality lookup from it", async () => {
  assert.equal(
    await db.scalar<string>(
      "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'lexical_entry' AND column_name = 'slug'",
    ),
    "NO",
  );
  assert.match(
    await db.scalar<string>("SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_lexical_entry_slug'"),
    /USING btree \(slug\)$/,
  );
  await db.tx(async (tx) => {
    for (const text of ["to write", "a lot", "alot", "book"]) {
      await addEntry(tx, text);
    }
    await tx.exec("ANALYZE lexical_entry");
    await tx.exec("SET LOCAL enable_seqscan = off");
    const plan = (await tx.column<string>("EXPLAIN SELECT id FROM lexical_entry WHERE slug = $1", ["to-write"])).join(
      "\n",
    );
    assert.match(plan, /idx_lexical_entry_slug/);
  });
});

test("renaming an entry keeps its old slug and its old normalized_text alive", async () => {
  await db.tx(async (tx) => {
    const id = await addEntry(tx, "to write");
    assert.deepEqual(await redirects(tx), []);

    await tx.exec("UPDATE lexical_entry SET text = 'to write down' WHERE id = $1", [id]);
    assert.deepEqual(await redirects(tx), [
      { old_slug: "to-write", lexical_entry_id: id },
      { old_slug: "towrite", lexical_entry_id: id },
    ]);
    assert.equal(await resolve(tx, "to-write"), "to-write-down");
    assert.equal(await resolve(tx, "towrite"), "to-write-down");
  });
});

test("a second rename points every earlier name at the newest slug", async () => {
  await db.tx(async (tx) => {
    const id = await addEntry(tx, "alpha");
    await tx.exec("UPDATE lexical_entry SET text = 'beta' WHERE id = $1", [id]);
    await tx.exec("UPDATE lexical_entry SET text = 'gamma' WHERE id = $1", [id]);
    assert.deepEqual(await redirects(tx), [
      { old_slug: "alpha", lexical_entry_id: id },
      { old_slug: "beta", lexical_entry_id: id },
    ]);
    assert.equal(await resolve(tx, "alpha"), "gamma");
    assert.equal(await resolve(tx, "beta"), "gamma");
    assert.equal(await resolve(tx, "gamma"), null);
  });
});

test("renaming an entry back removes the redirects that are live again", async () => {
  await db.tx(async (tx) => {
    const id = await addEntry(tx, "to write");
    await tx.exec("UPDATE lexical_entry SET text = 'to write down' WHERE id = $1", [id]);
    await tx.exec("UPDATE lexical_entry SET text = 'to write' WHERE id = $1", [id]);
    assert.deepEqual(await redirects(tx), [
      { old_slug: "to-write-down", lexical_entry_id: id },
      { old_slug: "towritedown", lexical_entry_id: id },
    ]);
  });
});

test("a rename that keeps the slug records nothing", async () => {
  await db.tx(async (tx) => {
    const id = await addEntry(tx, "To Write");
    await tx.exec("UPDATE lexical_entry SET text = 'to  write' WHERE id = $1", [id]);
    assert.equal(await slugOf(tx, id), "to-write");
    assert.deepEqual(await redirects(tx), []);
  });
});

test("no redirect is recorded for a slug that another entry still uses", async () => {
  await db.tx(async (tx) => {
    const first = await addEntry(tx, "كِتَاب", { language: "ar" });
    const second = await addEntry(tx, "كُتَّاب", { language: "ar" });
    await tx.exec("UPDATE lexical_entry SET text = 'قلم' WHERE id = $1", [first]);
    assert.deepEqual(await redirects(tx), []);
    assert.equal(await slugOf(tx, second), "كتاب");

    await tx.exec("UPDATE lexical_entry SET text = 'دفتر' WHERE id = $1", [second]);
    assert.deepEqual(await redirects(tx), [{ old_slug: "كتاب", lexical_entry_id: second }]);
  });
});

test("a new entry that takes over an old slug removes the redirect", async () => {
  await db.tx(async (tx) => {
    const renamed = await addEntry(tx, "alpha");
    await tx.exec("UPDATE lexical_entry SET text = 'beta' WHERE id = $1", [renamed]);
    assert.equal(await resolve(tx, "alpha"), "beta");

    const successor = await addEntry(tx, "alpha");
    assert.deepEqual(await redirects(tx), []);
    assert.equal(await resolve(tx, "alpha"), null);
    assert.equal(await slugOf(tx, successor), "alpha");
  });
});

test("renaming an entry onto the old slug of another removes that redirect", async () => {
  await db.tx(async (tx) => {
    const first = await addEntry(tx, "alpha");
    await tx.exec("UPDATE lexical_entry SET text = 'beta' WHERE id = $1", [first]);
    const second = await addEntry(tx, "gamma");
    await tx.exec("UPDATE lexical_entry SET text = 'alpha' WHERE id = $1", [second]);
    assert.deepEqual(await redirects(tx), [{ old_slug: "gamma", lexical_entry_id: second }]);
  });
});

test("deleting an entry removes its redirects", async () => {
  await db.tx(async (tx) => {
    const id = await addEntry(tx, "alpha");
    await tx.exec("UPDATE lexical_entry SET text = 'beta' WHERE id = $1", [id]);
    assert.equal((await redirects(tx)).length, 1);
    await tx.exec("DELETE FROM lexical_entry WHERE id = $1", [id]);
    assert.deepEqual(await redirects(tx), []);
  });
});

test("an old normalized_text key redirects to the slug of its entry", async () => {
  await db.tx(async (tx) => {
    await addEntry(tx, "to write");
    await addEntry(tx, "a lot");
    assert.equal(await resolve(tx, "towrite"), "to-write");
    assert.equal(await resolve(tx, "alot"), "a-lot");
  });
});

test("a key that is a live slug is never redirected", async () => {
  await db.tx(async (tx) => {
    await addEntry(tx, "a lot");
    await addEntry(tx, "alot");
    assert.equal(await resolve(tx, "alot"), null);
    assert.equal(await resolve(tx, "a-lot"), null);
  });
});

test("an old key shared by entries with different slugs resolves to the slug of the lowest id", async () => {
  await db.tx(async (tx) => {
    const low = await addEntry(tx, "al ot");
    const high = await addEntry(tx, "a lot");
    assert.ok(low < high);
    assert.equal(await slugOf(tx, low), "al-ot");
    assert.equal(await slugOf(tx, high), "a-lot");
    assert.equal(await resolve(tx, "alot"), "al-ot");
  });
  await db.tx(async (tx) => {
    const low = await addEntry(tx, "a lot");
    const high = await addEntry(tx, "al ot");
    assert.ok(low < high);
    assert.equal(await resolve(tx, "alot"), "a-lot");
  });
});

test("an unverified entry with the lowest id does not take the old key", async () => {
  await db.tx(async (tx) => {
    await addEntry(tx, "a lot", { verified: false });
    await addEntry(tx, "al ot");
    assert.equal(await resolve(tx, "alot"), "al-ot");
  });
});

test("a redirect row wins over an old normalized_text match", async () => {
  await db.tx(async (tx) => {
    const renamed = await addEntry(tx, "alpha beta");
    await tx.exec("UPDATE lexical_entry SET text = 'gamma' WHERE id = $1", [renamed]);
    const holder = await addEntry(tx, "alp habeta");
    assert.equal(await slugOf(tx, holder), "alp-habeta");
    assert.equal(await resolve(tx, "alphabeta"), "alp-habeta");

    await tx.exec("INSERT INTO entry_slug_redirect (old_slug, lexical_entry_id) VALUES ('alphabeta', $1)", [renamed]);
    assert.equal(await resolve(tx, "alphabeta"), "gamma");
  });
});

test("an unknown key resolves to nothing", async () => {
  await db.tx(async (tx) => {
    await addEntry(tx, "to write");
    assert.equal(await resolve(tx, "never-existed"), null);
    assert.equal(await resolve(tx, ""), null);
    assert.equal(await resolve(tx, "---"), null);
  });
});

test("an unverified entry is never a redirect target", async () => {
  await db.tx(async (tx) => {
    await addEntry(tx, "to write", { verified: false });
    assert.equal(await resolve(tx, "towrite"), null);

    const renamed = await addEntry(tx, "alpha", { verified: false });
    await tx.exec("UPDATE lexical_entry SET text = 'beta' WHERE id = $1", [renamed]);
    assert.equal(await resolve(tx, "alpha"), null);
    await tx.exec("UPDATE lexical_entry SET is_verified = true WHERE id = $1", [renamed]);
    assert.equal(await resolve(tx, "alpha"), "beta");
  });
});

test("a key that is not canonical resolves to the entry with the canonical slug", async () => {
  await db.tx(async (tx) => {
    await addEntry(tx, "to write");
    await addEntry(tx, "كَتَبَ", { language: "ar" });
    assert.equal(await resolve(tx, "To-Write"), "to-write");
    assert.equal(await resolve(tx, "to  write"), "to-write");
    assert.equal(await resolve(tx, "كَتَبَ"), "كتب");
    assert.equal(await resolve(tx, "كتب"), null);
    assert.equal(await resolve(tx, `${String.fromCodePoint(0x06a9)}تب`), "كتب");
  });
});

test("the translation and relation views expose the slug of the target entry", async () => {
  await db.tx(async (tx) => {
    const book = await addEntry(tx, "book");
    const kitab = await addEntry(tx, "كِتَاب", { language: "ar" });
    const phrase = await addEntry(tx, "to write");
    const senses: number[] = [];
    for (const entry of [book, kitab, phrase]) {
      senses.push(
        await tx.scalar<number>(
          "INSERT INTO sense (lexical_entry_id, pos, sense_number, definitions) VALUES ($1, 'noun', 1, ARRAY['x']) RETURNING id",
          [entry],
        ),
      );
    }
    const [bookSense, kitabSense, phraseSense] = senses;
    await tx.exec("INSERT INTO translation_link (en_sense_id, ar_sense_id) VALUES ($1, $2)", [bookSense, kitabSense]);
    await tx.exec("INSERT INTO sense_relation (sense_id_1, sense_id_2, relation_type) VALUES ($1, $2, 'synonym')", [
      bookSense,
      phraseSense,
    ]);

    assert.equal(
      await tx.scalar<string>("SELECT target_slug FROM sense_translation_normalized WHERE sense_id = $1", [bookSense]),
      "كتاب",
    );
    assert.equal(
      await tx.scalar<string>("SELECT target_slug FROM sense_translation_normalized WHERE sense_id = $1", [kitabSense]),
      "book",
    );
    assert.equal(
      await tx.scalar<string>("SELECT target_slug FROM sense_relation_normalized WHERE sense_id = $1", [bookSense]),
      "to-write",
    );
    assert.equal(
      await tx.scalar<string>("SELECT target_slug FROM sense_relation_normalized WHERE sense_id = $1", [phraseSense]),
      "book",
    );
  });
});
