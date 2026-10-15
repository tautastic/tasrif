import assert from "node:assert/strict";
import { test } from "node:test";
import "./next-runtime.ts";
import { openRepository } from "./repository-db.ts";
import { setRequestScope } from "./stubs/next-headers.ts";

const { sql } = await openRepository();

const session = await import("~/server/auth/session");
const patternActions = await import("~/server/actions/morph-pattern");

interface PatternRow {
  rules: Record<string, unknown>;
  form_number: number;
  no_affix: boolean;
}

const patternOf = (code: string): Promise<PatternRow> =>
  sql.one<PatternRow>("SELECT rules, form_number, no_affix FROM morph_pattern WHERE code = $1", [code]);

const preview = async (code: string, root: string) => {
  setRequestScope({ cookies: { [session.SESSION_COOKIE_NAME]: await session.createSessionToken() } });
  const pattern = await patternOf(code);
  const result = await patternActions.previewMorphPatternAction({
    root,
    rules: pattern.rules as never,
    formNumber: pattern.form_number,
    noAffix: pattern.no_affix,
  });
  assert.ok(result.ok);
  return result.data;
};

test("the pattern preview returns the passive paradigm next to the active one", async () => {
  const data = await preview("f1-a-u", "كتب");
  assert.equal(data.passive.length, 52);
  assert.equal(data.conjugation.length, 57);
  const cell = (mood: string, person: string) =>
    data.passive.find((row) => row.mood === mood && row.person === person)?.form;
  assert.equal(cell("perfect", "third_person_masculine_singular"), "كُتِبَ");
  assert.equal(cell("imperfect_indicative", "third_person_masculine_singular"), "يُكْتَبُ");
  assert.equal(cell("imperfect_jussive", "second_person_feminine_plural"), "تُكْتَبْنَ");
  assert.equal(
    data.passive.some((row) => row.mood === "imperative"),
    false,
  );
});

test("the pattern preview of a no-affix pattern spells the passive out per person", async () => {
  const data = await preview("f1-a-i-final-weak", "رمي");
  const cell = (mood: string, person: string) =>
    data.passive.find((row) => row.mood === mood && row.person === person)?.form;
  assert.equal(cell("perfect", "third_person_masculine_singular"), "رُمِيَ");
  assert.equal(cell("imperfect_indicative", "third_person_masculine_plural"), "يُرْمَوْنَ");
  assert.equal(cell("imperfect_jussive", "third_person_masculine_singular"), "يُرْمَ");
});

test("the pattern preview of a pattern without passive rules has no passive paradigm", async () => {
  const data = await preview("f7", "كسر");
  assert.deepEqual(data.passive, []);
  assert.ok(data.conjugation.length > 0);
});
