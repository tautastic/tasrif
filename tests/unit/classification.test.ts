import assert from "node:assert/strict";
import { test } from "node:test";
import { ROOT_SAMPLES } from "../fixtures/roots.ts";
import { assertSqlState, openDatabase } from "../harness";

const db = await openDatabase();

const char = (point: number) => String.fromCodePoint(point);

const TATWEEL = char(0x0640);
const FATHA = char(0x064e);
const SHADDA = char(0x0651);
const SUKUN = char(0x0652);
const WAVY_HAMZA_BELOW = char(0x065f);
const SUPERSCRIPT_ALEF = char(0x0670);
const QURANIC_SAJDAH = char(0x06e9);
const ZWNJ = char(0x200c);
const ZWJ = char(0x200d);
const RLM = char(0x200f);
const NBSP = char(0x00a0);

interface Classification {
  radical1: string;
  radical2: string;
  radical3: string;
  is_geminate: boolean;
}

const classify = (root: string): Promise<Classification> =>
  db.one<Classification>("SELECT (classify_root($1)).*", [root]);

const classifyRadical = (radical: string): Promise<string> =>
  db.scalar<string>("SELECT classify_root_radical($1)::text", [radical]);

const labelsOf = (root: string): Promise<string[]> => db.scalar<string[]>("SELECT describe_root($1)", [root]);

const labelsFor = (radical1: string, radical2: string, radical3: string, geminate: boolean): Promise<string[]> =>
  db.scalar<string[]>("SELECT root_classification_labels(ROW($1, $2, $3, $4)::root_classification)", [
    radical1,
    radical2,
    radical3,
    geminate,
  ]);

const SHAPE_EXPECTATIONS: Record<string, Classification> = {
  sound: { radical1: "sound", radical2: "sound", radical3: "sound", is_geminate: false },
  "assimilated-waw": { radical1: "waw", radical2: "sound", radical3: "sound", is_geminate: false },
  "assimilated-ya": { radical1: "ya", radical2: "sound", radical3: "sound", is_geminate: false },
  "hollow-waw": { radical1: "sound", radical2: "waw", radical3: "sound", is_geminate: false },
  "hollow-ya": { radical1: "sound", radical2: "ya", radical3: "sound", is_geminate: false },
  "final-weak-waw": { radical1: "sound", radical2: "sound", radical3: "waw", is_geminate: false },
  "final-weak-ya": { radical1: "sound", radical2: "sound", radical3: "ya", is_geminate: false },
  geminate: { radical1: "sound", radical2: "sound", radical3: "sound", is_geminate: true },
  "hamzated-first": { radical1: "hamza", radical2: "sound", radical3: "sound", is_geminate: false },
  "hamzated-second": { radical1: "sound", radical2: "hamza", radical3: "sound", is_geminate: false },
  "hamzated-third": { radical1: "sound", radical2: "sound", radical3: "hamza", is_geminate: false },
  "hamzated-second-final-weak-ya": { radical1: "sound", radical2: "hamza", radical3: "ya", is_geminate: false },
  "hollow-waw-final-weak-ya": { radical1: "sound", radical2: "waw", radical3: "ya", is_geminate: false },
  "assimilated-waw-final-weak-ya": { radical1: "waw", radical2: "sound", radical3: "ya", is_geminate: false },
};

test("classify_root_radical maps waw and ya to their own kinds", async () => {
  assert.equal(await classifyRadical("و"), "waw");
  assert.equal(await classifyRadical("ي"), "ya");
});

test("classify_root_radical treats every hamza carrier as hamza", async () => {
  for (const carrier of ["ء", "أ", "إ", "آ", "ؤ", "ئ"]) {
    assert.equal(await classifyRadical(carrier), "hamza", `carrier ${carrier}`);
  }
});

test("classify_root_radical treats ordinary consonants as sound", async () => {
  for (const consonant of ["ب", "ت", "ج", "د", "ر", "س", "ع", "ف", "ق", "ك", "ل", "م", "ن", "ه"]) {
    assert.equal(await classifyRadical(consonant), "sound", `consonant ${consonant}`);
  }
});

test("classify_root_radical treats bare alef, alef maksura and teh marbuta as sound", async () => {
  assert.equal(await classifyRadical("ا"), "sound");
  assert.equal(await classifyRadical("ى"), "sound");
  assert.equal(await classifyRadical("ة"), "sound");
});

test("classify_root_radical falls back to sound for input that is not a single known letter", async () => {
  assert.equal(await classifyRadical(""), "sound");
  assert.equal(await classifyRadical("كت"), "sound");
});

test("classify_root returns the expected radical kinds for every sampled root shape", async () => {
  for (const sample of ROOT_SAMPLES) {
    const expected = SHAPE_EXPECTATIONS[sample.shape];
    assert.ok(expected, `no expectation registered for shape ${sample.shape}`);
    assert.deepEqual(await classify(sample.root), expected, `${sample.shape} (${sample.root})`);
  }
});

test("classify_root ignores diacritics, tatweel, joiners and separators", async () => {
  const bare = await classify("كتب");
  const noisy: [string, string][] = [
    ["tatweel", `ك${TATWEEL}ت${TATWEEL}ب`],
    ["harakat", `ك${FATHA}ت${FATHA}ب${SUKUN}`],
    ["shadda", `كت${SHADDA}ب`],
    ["wavy hamza below", `ك${WAVY_HAMZA_BELOW}تب`],
    ["superscript alef", `ك${SUPERSCRIPT_ALEF}تب`],
    ["quranic annotation", `ك${QURANIC_SAJDAH}تب`],
    ["spaces", "ك ت ب"],
    ["hyphens", "ك-ت-ب"],
    ["tab and newline", "ك\tت\nب"],
    ["zero width non-joiner", `ك${ZWNJ}ت${ZWNJ}ب`],
    ["zero width joiner", `ك${ZWJ}ت${ZWJ}ب`],
    ["surrounding whitespace", "  كتب  "],
  ];
  for (const [label, root] of noisy) {
    assert.deepEqual(await classify(root), bare, label);
  }
});

test("classify_root does not strip digits, punctuation or dotless letters", async () => {
  const survivors: [string, string][] = [
    ["arabic-indic digit zero", `ك${char(0x0660)}تب`],
    ["arabic comma", `ك${char(0x060c)}تب`],
    ["dotless beh", `ك${char(0x066e)}تب`],
  ];
  for (const [label, root] of survivors) {
    const failure = await db.failure("SELECT classify_root($1)", [root]);
    assertSqlState(failure, "22023", /must have exactly 3 radicals after normalization, found 4/);
    assert.ok(failure.message.includes(root), `${label} should echo the original root`);
  }
});

test("classify_root strips bidi marks and non-breaking spaces", async () => {
  const stripped: [string, string][] = [
    ["right-to-left mark", `ك${RLM}تب`],
    ["non-breaking space", `ك${NBSP}تب`],
  ];
  for (const [label, root] of stripped) {
    const classification = await classify(root);
    assert.deepEqual(
      classification,
      { radical1: "sound", radical2: "sound", radical3: "sound", is_geminate: false },
      `${label} should be discarded rather than counted as a radical`,
    );
  }
});

test("classify_root marks a doubled sound final radical as geminate", async () => {
  const classification = await classify("مدد");
  assert.equal(classification.is_geminate, true);
});

test("classify_root does not mark doubled weak or hamza radicals as geminate", async () => {
  assert.equal((await classify("حوو")).is_geminate, false);
  assert.equal((await classify("حيي")).is_geminate, false);
  assert.equal((await classify("سأأ")).is_geminate, false);
});

test("classify_root only considers the second and third radicals for gemination", async () => {
  const classification = await classify("ددر");
  assert.equal(classification.is_geminate, false);
});

test("classify_root rejects roots that do not reduce to exactly three radicals", async () => {
  const cases: [string, number][] = [
    ["", 0],
    ["   ", 0],
    [`${FATHA}${FATHA}${FATHA}`, 0],
    ["كت", 2],
    ["كتاب", 4],
    ["كتابه", 5],
  ];
  for (const [root, count] of cases) {
    const failure = await db.failure("SELECT classify_root($1)", [root]);
    assertSqlState(failure, "22023", new RegExp(`must have exactly 3 radicals after normalization, found ${count}`));
  }
});

test("classify_root reports the original unnormalized root in its error message", async () => {
  const failure = await db.failure("SELECT classify_root($1)", ["كـتـاب"]);
  assertSqlState(failure, "22023");
  assert.ok(failure.message.includes("كـتـاب"), "message should quote the root exactly as supplied");
});

test("classify_root treats NULL as an empty root", async () => {
  const failure = await db.failure("SELECT classify_root(NULL)");
  assertSqlState(failure, "22023", /root '<NULL>' must have exactly 3 radicals after normalization, found 0/);
});

test("root_classification_labels names each weakness individually", async () => {
  assert.deepEqual(await labelsFor("waw", "sound", "sound", false), ["assimilated"]);
  assert.deepEqual(await labelsFor("ya", "sound", "sound", false), ["assimilated"]);
  assert.deepEqual(await labelsFor("sound", "waw", "sound", false), ["hollow"]);
  assert.deepEqual(await labelsFor("sound", "ya", "sound", false), ["hollow"]);
  assert.deepEqual(await labelsFor("sound", "sound", "waw", false), ["final-weak"]);
  assert.deepEqual(await labelsFor("sound", "sound", "ya", false), ["final-weak"]);
  assert.deepEqual(await labelsFor("sound", "sound", "sound", true), ["geminate"]);
  assert.deepEqual(await labelsFor("hamza", "sound", "sound", false), ["hamzated"]);
  assert.deepEqual(await labelsFor("sound", "hamza", "sound", false), ["hamzated"]);
  assert.deepEqual(await labelsFor("sound", "sound", "hamza", false), ["hamzated"]);
});

test("root_classification_labels falls back to sound when nothing applies", async () => {
  assert.deepEqual(await labelsFor("sound", "sound", "sound", false), ["sound"]);
});

test("root_classification_labels emits labels in a stable documented order", async () => {
  assert.deepEqual(await labelsFor("waw", "ya", "waw", true), ["assimilated", "hollow", "final-weak", "geminate"]);
  assert.deepEqual(await labelsFor("waw", "hamza", "ya", true), ["assimilated", "final-weak", "geminate", "hamzated"]);
  assert.deepEqual(await labelsFor("hamza", "waw", "ya", false), ["hollow", "final-weak", "hamzated"]);
});

test("describe_root labels the sampled roots", async () => {
  const expectations: [string, string[]][] = [
    ["كتب", ["sound"]],
    ["وعد", ["assimilated"]],
    ["يسر", ["assimilated"]],
    ["قول", ["hollow"]],
    ["بيع", ["hollow"]],
    ["دعو", ["final-weak"]],
    ["رمي", ["final-weak"]],
    ["مدد", ["geminate"]],
    ["أكل", ["hamzated"]],
    ["سأل", ["hamzated"]],
    ["قرأ", ["hamzated"]],
    ["روي", ["hollow", "final-weak"]],
    ["وقي", ["assimilated", "final-weak"]],
    ["وأي", ["assimilated", "final-weak", "hamzated"]],
  ];
  for (const [root, expected] of expectations) {
    assert.deepEqual(await labelsOf(root), expected, root);
  }
});

test("describe_root agrees with root_classification_labels applied to classify_root", async () => {
  for (const sample of ROOT_SAMPLES) {
    const composed = await db.scalar<string[]>("SELECT root_classification_labels(classify_root($1))", [sample.root]);
    assert.deepEqual(await labelsOf(sample.root), composed, sample.root);
  }
});

test("describe_root propagates the invalid root error", async () => {
  const failure = await db.failure("SELECT describe_root($1)", ["كتاب"]);
  assertSqlState(failure, "22023", /must have exactly 3 radicals after normalization, found 4/);
});
