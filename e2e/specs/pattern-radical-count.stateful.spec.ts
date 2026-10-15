import type { Db } from "../../tests/harness/client.ts";
import { expect, test } from "../support/fixtures.ts";

const CODE = "f1-radicalcount-probe";

interface StoredPattern {
  radical_count: number;
  form_number: number;
  radical1_kind: string;
  radical2_kind: string;
  radical3_kind: string;
  radical4_kind: string;
  is_geminate: boolean;
  perfect_vowel: string | null;
  imperfect_vowel: string | null;
}

const removePattern = (db: Db) => db.exec("DELETE FROM morph_pattern WHERE code = $1", [CODE]);

const createPattern = (db: Db) =>
  db.scalar<number>(
    `INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, is_lexical,
                                radical2_kind, radical3_kind, is_geminate, perfect_vowel, imperfect_vowel)
     SELECT $1, 1, vocalic_template, 'test only, radical count round trip', rules, TRUE,
            'hamza', 'ya', TRUE, 'a', 'a'
     FROM morph_pattern WHERE code = 'f1-a-u'
     RETURNING id`,
    [CODE],
  );

const readPattern = (db: Db, id: number) =>
  db.one<StoredPattern>(
    `SELECT radical_count, form_number, radical1_kind::text, radical2_kind::text, radical3_kind::text,
            radical4_kind::text, is_geminate, perfect_vowel::text, imperfect_vowel::text
     FROM morph_pattern WHERE id = $1`,
    [id],
  );

test.describe("the radical count of a stored pattern", () => {
  let id = 0;

  test.beforeEach(async ({ db }) => {
    await removePattern(db);
    id = await createPattern(db);
  });

  test.afterEach(async ({ db }) => {
    await removePattern(db);
  });

  test("switching to four radicals and back before saving leaves the stored pattern as it was", async ({
    adminPage,
    db,
  }) => {
    const before = await readPattern(db, id);
    expect(before).toMatchObject({ radical2_kind: "hamza", radical3_kind: "ya", is_geminate: true });

    await adminPage.goto(`/admin/morph-patterns/${id}/edit`);
    await adminPage.locator("#radicalCount").selectOption("4");
    await adminPage.locator("#radicalCount").selectOption("3");
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(new RegExp(`/admin/morph-patterns/${id}$`));

    expect(await readPattern(db, id)).toEqual(before);
  });

  test("a pattern saved with four radicals stores sound kinds for the first three and is not geminate", async ({
    adminPage,
    db,
  }) => {
    await adminPage.goto(`/admin/morph-patterns/${id}/edit`);
    await adminPage.locator("#radicalCount").selectOption("4");
    await adminPage.locator("#rules-masdar").fill("فَعْلَقَة");
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(new RegExp(`/admin/morph-patterns/${id}$`));

    expect(await readPattern(db, id)).toEqual({
      radical_count: 4,
      form_number: 1,
      radical1_kind: "sound",
      radical2_kind: "sound",
      radical3_kind: "sound",
      radical4_kind: "sound",
      is_geminate: false,
      perfect_vowel: "a",
      imperfect_vowel: "a",
    });
  });
});
