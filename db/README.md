# Database scripts

`db/` holds everything that builds the schema and the morphology engine:

- `db/schema.sql` creates the `pg_trgm` extension, the enum types, the tables, the indexes and the views. It is the SQL
  form of `src/server/db/schema/` and holds no function, trigger or row.
- `db/NNNN_<name>.sql` are numbered scripts that define the SQL functions and triggers and load reference data
  (`morph_pattern`, `affix_rules`, `lexical_pattern_override`).

`schema.sql` runs first, then every numbered script in name order.

## Building the database

There is no migration step. `docker/db/init.sh` runs once, when the `db` container starts on an empty volume. It creates
the application role and database, then applies `schema.sql` and the scripts with one `psql --single-transaction`:
either the database is complete or the container stops. The test harness (`tests/harness/database.ts`) loads the same
files in the same order into a template database.

Nothing records which files a database has seen and nothing upgrades one in place. A change under `db/`, or to the
schema, reaches a deployment by building a new database from the new files (see "Rebuilding the database" in
`setup.md`). Every file therefore only has to work on an empty database.

## Adding a change

- A table, column, index or view: edit `src/server/db/schema/` and `db/schema.sql` together.
  `tests/invariants/schema-parity.test.ts` fails when the tables, columns, nullability, constraints, foreign keys or
  indexes of the two disagree, and `tests/invariants/enum-parity.test.ts` does the same for the enum types. A column that
  a script fills in and then tightens (`code` in `0013`, `slug` in `0040`) is declared `NOT NULL` in the Drizzle
  schema and created nullable in `schema.sql`.
- A function, trigger or reference-data change: add the next numbered script, or edit the script that owns it. Finish
  with `SELECT regenerate_all_derived_stems();` when generated output changes.
- Run `pnpm test`; if a golden changes, regenerate it with `UPDATE_GOLDENS=1 pnpm test` and read the diff
  (see `tests/README.md`).

## Pattern identity and resolution

Every `morph_pattern` row has a `code` (for example `f1-a-u-hollow-waw`), a stable identifier for scripts, tests and
tools. Never identify a pattern by `description`, which admins edit, or by `id`, which differs between databases.

`resolve_morph_pattern_id(root, form, perfect_vowel, imperfect_vowel, radical_count DEFAULT 3)` (the verb form
picker) works in this order:

1. a `lexical_pattern_override` row for the cleaned root, form and vowels wins;
2. otherwise the root is classified with `classify_root` (radical kinds and gemination, the "root shape");
3. the pattern is the one `morph_pattern_resolution` row with that form, radical count, those vowels and that shape, or
   NULL. The shape of a four-radical root is the kind of its last radical alone (sound, ya or waw); see
   "Quadriliteral verbs".

`morph_pattern_resolution` holds one row per (root shape, verb form choice). Its unique key makes ambiguity
impossible: the database refuses a second pattern for a pair that already resolves. One pattern may serve several
shapes. A non-lexical pattern always resolves its own shape (its `radical*_kind` and `is_geminate` columns): a trigger
adds that row when the pattern is inserted and follows later edits of the radical kinds, form, vowels and `is_lexical`.
A lexical pattern holds no rows: it is reached only through overrides. The form and vowels of a resolution row are
always copied from its pattern.

`code` is checked against `^f[0-9]+(-[a-z]+)*$`, is unique and can never change after insertion (an `UPDATE` that
changes it raises SQLSTATE `23000`). By convention it is `morph_pattern_code(form_number, perfect_vowel,
imperfect_vowel, description)`: `f` and the form number, then `-<perfect>-<imperfect>` for form I, then the
description in lower case with every run of characters other than `a`-`z` (spaces, punctuation, digits, Arabic) turned
into one `-`. A leading vowel label such as `a ~ u` is dropped because it repeats the vowels.

| form | vowels | description | code |
| --- | --- | --- | --- |
| 1 | a ~ u | `a ~ u` | `f1-a-u` |
| 1 | a ~ u | `a ~ u, hollow waw` | `f1-a-u-hollow-waw` |
| 1 | a ~ a | `a ~ a, final-weak, hamzated middle, hamza elided` | `f1-a-a-final-weak-hamzated-middle-hamza-elided` |
| 2 | | (empty) | `f2` |
| 8 | | `final-weak ya` | `f8-final-weak-ya` |

When a row is inserted without a code (the admin UI never sends one), a trigger derives it this way and appends
`-b`, `-c`, … if it is taken.

`schema.sql` runs before the numbered scripts, and the seeded descriptions only reach their final text in `0007` and
`0009`. So `schema.sql` creates `code` as a nullable column (with its unique and check constraints) and the empty
resolution table. `0013_morph_pattern_identity.sql` then:

- gives the 28 seeded patterns their codes, matched by resolution key (form, vowels, radical kinds, gemination,
  `is_lexical`) so that a description edited by an admin does not change them;
- derives the codes of any other pattern from its description;
- sets `code` to `NOT NULL` and installs the triggers;
- seeds the resolution table from each non-lexical pattern's own columns, keeping the lowest id when two patterns share
  a key. That is the pattern the old `ORDER BY id LIMIT 1` lookup returned, so resolution is unchanged.

## Adding a pattern

Patterns are data. Add them in a new numbered script instead of redefining a function.

1. **Insert the row, with its code written out:**

   ```sql
   INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                              radical1_kind, radical2_kind, radical3_kind, is_geminate,
                              perfect_vowel, imperfect_vowel)
   VALUES ('<code>', <form>, '<vocalic template>', '<description>', '<rules>'::jsonb,
           <no_affix>, <is_lexical>, '<radical1 kind>', '<radical2 kind>', '<radical3 kind>', <is_geminate>,
           <perfect vowel or NULL>, <imperfect vowel or NULL>);
   ```

   - `code`: follow the convention above; check it with `morph_pattern_code`, for example
     `SELECT morph_pattern_code(1, 'a', 'u', 'a ~ u, hollow waw')` returns the seeded `f1-a-u-hollow-waw`. It must be
     unique.
   - `form_number` 1 to 10. `perfect_vowel` and `imperfect_vowel`: both for form I, neither for the other forms.
   - `radical1_kind`, `radical2_kind`, `radical3_kind` (`sound`, `waw`, `ya`, `hamza`) and `is_geminate`: the root
     shape the templates are written for, in the terms `classify_root` uses.
   - `rules`, `no_affix`, `vocalic_template`, `description`: as for the seeded patterns in `0004`. `description` is
     display text and must be unique within the form and the radical count.
   - `is_lexical`: `FALSE` for a shape pattern. The insert then registers the pattern's own shape automatically. It
     fails with a unique violation on `unique_morph_pattern_resolution_key` if another pattern already resolves that
     shape for this form and vowels.

2. **Register any further shape the same templates serve** (optional), with a root of that shape as the example:

   ```sql
   SELECT add_morph_pattern_resolution('<code>', '<example root of the further shape>');
   ```

   The root is classified with `classify_root` and the shape is registered for the pattern's form and vowels.
   Registering the same pair again does nothing; the call fails if the pair already resolves to another pattern
   (`23505`, naming it), if the code is unknown (`P0002`), if the pattern is lexical (`23514`) or if the root does not
   have as many radicals as the pattern (`22023`). To hand a shape over to another pattern, delete its row first:
   `DELETE FROM morph_pattern_resolution WHERE morph_pattern_id = morph_pattern_id_for_code('<code>') AND
   (radical1_kind, radical2_kind, radical3_kind, is_geminate) = ('<kind>', '<kind>', '<kind>', <geminate>);`. Never delete
   a pattern's own shape.

3. **A pattern for one irregular verb** is inserted with `is_lexical = TRUE` and reached through an override:

   ```sql
   INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
   VALUES ('رأي', 1, 'a', 'a', morph_pattern_id_for_code('f1-a-a-final-weak-hamzated-middle-hamza-elided'), '…');
   ```

4. **Refer to existing patterns only through `morph_pattern_id_for_code('<code>')`.** It raises `P0002` for an
   unknown code, so a typo fails the script instead of silently matching nothing.

5. **Tests.**
   - Add Tier-A expectations for the new paradigm with their sources (`tests/fixtures/`, asserted in
     `tests/paradigm/`). Look the pattern up with `findPatternByCode(db, '<code>')` from `tests/harness`.
   - Run `UPDATE_GOLDENS=1 pnpm test` and read the diffs: a new `tests/golden/paradigms/form-NN-<description>.txt`,
     and `tests/golden/resolution-matrix.txt`, where only the cells you meant to fill may turn from `-` to `X`.
   - `tests/invariants/pattern-data.test.ts` covers every pattern without wiring: the shape of `rules`, every
     non-lexical pattern resolves its own shape, no lexical pattern resolves any shape, resolution rows carry their
     pattern's form and vowels, a hamza radical of every resolved shape is written as a placeholder in every rule, and
     every lexical pattern has an override.
   - A data-only script does not change `tests/golden/function-inventory.txt`.
   - Tests that need a pattern of their own insert it inside a rolled-back transaction with a shape no real pattern can
     take (form I with the vowel pair `u ~ i` or `i ~ u`) and a description starting with `test only`, and compare counts
     with what was there before rather than with a literal. They must not rely on any real (shape, form) pair staying
     unresolved, because adding patterns is how the catalogue grows.

## Pattern variants

An entry gets its pattern from the verb form choice, and `lexical_pattern_override` is keyed by root, form and vowels. When
one root has two verbs of the same form that inflect differently (اِسْتَجَابَ, hollow, and اِسْتَجْوَبَ, strong, both form X of
جوب, Wright §163) the second one is a *variant*: an override row with `variant` set to a short lower-case name
(`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, at most 40 characters). `variant` is part of the unique key
(`unique_lexical_pattern_override_key`); NULL means the default row and there is at most one default per root, form and vowels.

- `resolve_morph_pattern_id` looks only at rows with `variant IS NULL` (`0080`), so a variant never becomes the pattern the
  verb form picker resolves. Without that condition the lowest override id would win and the variant would take over the default.
- A variant row must point to a lexical pattern of its own form and vowels; a trigger (`0100`) refuses anything else with
  SQLSTATE `23514`, and so does the admin action before it reaches the database.
- `morph_pattern_variants(root, form, perfect_vowel, imperfect_vowel)` lists the patterns an entry of that root and form
  may use: the resolved pattern first (`is_default`), then the variants of the same root (canonical hamza spelling), form and
  vowels in name order, each with the code, description, the variant's note and `sample`, the third person masculine perfect
  the pattern gives for the root. `morph_pattern_choice_allowed(...)` answers whether one pattern id is in that list; the entry
  action stores a chosen pattern only when it is.
- The entry form shows a "Verb variant" select next to the verb form when the list has more than one pattern
  (`/api/verb-form/variants`). Saving an entry without a choice keeps the stored pattern while it is still allowed, so an edit
  never moves an entry from its variant back to the default.
- `0102` ships the worked example: جوب, form X, variant `interrogate`, pattern `f10-hollow-strong-inflection`.

The coverage matrix and the pattern preview do not see variants: the matrix resolves shapes, and the preview takes the rules and
the root it is given. The pattern page lists every override with its variant.

## Alternative forms

The conjugation table has one form per cell. Attested alternatives that the primary paradigm drops (the geminate jussive
يَمُدَّ / يَمُدِّ / يَمْدُدْ and imperative مُدَّ / اُمْدُدْ, سَلْ beside اِسْأَلْ, اُؤْمُرْ beside مُرْ, the two seats of the hamza in
جَاؤُوا / جَائُوا) are data in `morph_pattern_alternative`, read when an entry page is built. Nothing in the generators or the
regeneration triggers knows about them, so the stored paradigm, the stems, the search vector and every golden are unchanged.

Each row is a complete word template for one cell (`mood`, `person`, `voice` and an `ordinal` that orders the alternatives of the
cell), written with the same `{1}` `{2}` `{3}` placeholders as `rules`, prefix and suffix included:

- `morph_pattern_id`: the pattern; every entry of the pattern gets the alternative when `root` is NULL.
- `root`: restricts the row to one verb (stored with `strip_root_noise`, compared by `canonical_hamza_root`). سَلْ and اُؤْمُرْ
  belong to the verb سأل and أمر, not to the shape pattern they share with other verbs.
- `verbatim`: skip `normalize_arabic_orthography` and keep the spelling as written. The hamza spelling variants need it,
  because the normaliser rewrites `ئُ` after alef to `ؤُ`, which is the primary form.
- `note`: where the alternative comes from.

A pattern with four radicals uses `{4}` as well. `entry_alternative_forms` (redefined for four radicals in `0107`, with the
rows of form IVq) takes the root as it is stored, matches a root only to a pattern of its own radical count, and passes the
fourth letter to the templates when the pattern has one. An entry whose stored root has a different length from its pattern gets
no alternative.

`entry_alternative_forms(entry_ids integer[])` evaluates the templates of the entries (form VIII infix assimilation included),
drops an alternative equal to the stored form of its cell or to another alternative of the cell, and returns
`(lexical_entry_id, voice, mood, person, ordinal, form)` in cell and ordinal order. It is a PL/pgSQL function with a forced
generic plan: the inlined SQL version spent about 2 ms per call planning its own expressions, this one about 0.1 ms for an entry
without alternatives and 1 ms for a geminate entry of 12 alternatives. `getLexicalEntryBySlug` calls it once for all the
verb entries of the page, in parallel with the root count, so a page costs one query more than before (three instead of two)
however many persons have alternatives, and a page without a verb costs none.

**Passive alternatives (`0117`).** A row with `voice = 'passive'` is an alternative of a passive cell. The shipped ones are the
jussive of the passive of the seven geminate patterns that carry a passive (`f1-a-u-geminate`, `f1-i-a-geminate`,
`f1-a-i-geminate`, `f3-geminate`, `f4-geminate`, `f8-geminate`, `f10-geminate`: يُمَدَّ beside يُمَدِّ and يُمْدَدْ), 70 rows, and the
second seat of the hamza before the plural ending in the passive of the three hollow patterns with a final hamza (جِيئُوا beside
جِيؤُوا, تُجَاؤُونَ beside تُجَائُونَ), 21 rows. Wright vol. I §123 applies the rules of the geminate verb to the passive of the
first form and to the third, fourth, eighth and tenth forms. `entry_alternative_forms` (redefined in `0117`, after `0107`) lists an
alternative only for a cell the entry stores, so the entry of a verb whose table has no full passive (`no_passive`) gets none.
The entry page carries them as `passiveAlternatives` and lists them in the passive block.

**Notes and the checks against Wright (`0116`).** `note` records both the table and the section of Wright that was read. Form IX:
Wright §123 says that forms II, V, IX and XI undergo no contraction (De Goeje's note there ascribes the uncontracted jussives to
the dialect of Hijaz and the contracted ones to that of Tamim), while the three sourced tables of form IX print the contracted
spellings beside the base form; the base form stays the first spelling of the table and the others are alternatives. Form IVq
follows form IX (§118) and has the same notes. `يَكُ` beside `يَكُنْ` is Wright §151 rem. (sometimes further abbreviated,
especially by the poets). `tests/integration/alternatives-sql.test.ts` pins these notes.

**No editor.** The rows are reference data taken from tables whose pages and revisions are named in the fixtures, so they are
added in numbered scripts and checked cell by cell by `alternatives-sources.test.ts`. There is no admin form for them: a form
would let a row without a source into the data and skip that check. Whether the maintainers want one is open.

To add alternatives, insert rows in a numbered script with `morph_pattern_id_for_code('<code>')` and add the printed cells of the
verbs that show them to `tests/fixtures/alternatives-cells.ts`; `tests/paradigm/alternatives-sources.test.ts` then checks that an
entry gets exactly the printed forms other than its primary one, cell by cell, and that no other sourced paradigm gets any.

### Alternative verbal nouns

A second verbal noun (زَلْزَلَة beside زِلْزَال, وَسْوَاس beside وِسْوَاس) is not a cell of the conjugation, so it has a table of its
own, `morph_pattern_alternative_noun` (`schema.sql` and `0108`): `morph_pattern_id`, `root`,
`noun` (`masdar`, `active_participle` or `passive_participle`), `ordinal`, `template`, `verbatim` and `note`, with the same
meaning and the same unique key as the alternatives of a cell. `entry_alternative_nouns(entry_ids integer[])` returns
`(lexical_entry_id, noun, ordinal, form)` in the order of the enum and the ordinal. It lists a form only when the entry
stores that noun and the form differs from it, so an entry without a passive participle (`no_passive`) gets no alternative
for it, and an entry whose root has another length than its pattern gets none.

The shipped rows belong to a root, not to the pattern, because the tables of the other verbs of the first quadriliteral form
print one verbal noun (دَحْرَجَة); Wright vol. I §203 gives the noun فِعْلَال to reduplicated verbs. The two lexical patterns of
`0121` (أَبَى and أَوَى) carry the first printed noun in their rules and the others as rows:

| root | stored | alternatives | table |
| --- | --- | --- | --- |
| زلزل | زَلْزَلَة | زِلْزَال | زَلْزَلَ, revision 93326305 |
| ثرثر | ثَرْثَرَة | ثَرْثَار | ثَرْثَرَ, revision 93324245 |
| وسوس | وَسْوَسَة | وَسْوَاس, وِسْوَاس | وَسْوَسَ, revision 92748836 |
| أبي | إِبَاء | إِبَاءَة | أَبَى (a ~ a), revision 93045469 |
| أوي | إِوِيّ | أُوِيّ, إِوَاء | أَوَى, revision 93320081 |

`getLexicalEntryBySlug` reads the nouns in the same statement as the alternatives of the cells (a `UNION ALL` of the two
functions), so a page still costs three queries. The entry carries them as `alternativeNouns`, and `ConjugationTable` lists
them under the verbal noun, the active participle or the passive participle of the table of principal parts.

The tables of many triliteral verbs print several verbal nouns (عَضّ and عَضِيض, مَجِيء and جَيْء). They are not shipped: for
those verbs the stored noun is a schematic one, and which of the printed nouns is the main one is not decided by a table. To
ship one, add the row in a numbered script with `morph_pattern_id_for_code` and add the printed nouns to
`PRINTED_NOUN_ALTERNATIVES_FIXTURES` in `tests/fixtures/alternatives-cells.ts`.

## Quadriliteral verbs

`0080_quadriliteral_engine.sql` and `0081_quadriliteral_patterns.sql`, with the `radical_count` columns of `schema.sql`,
add verbs with four radicals. They keep the form numbers 1 to 4 and add
a radical count, so a verb form is the pair (`form_number`, `radical_count`); the names and public addresses carry a
`q`:

| form | picker choice | public address | code | pattern | example |
| --- | --- | --- | --- | --- | --- |
| Iq | `form-1q` | `/arabic-verb-form/1q` | `f1-a-i-quadriliteral` | فَعْلَلَ يُفَعْلِلُ | دَحْرَجَ يُدَحْرِجُ |
| IIq | `form-2q` | `/arabic-verb-form/2q` | `f2-quadriliteral` | تَفَعْلَلَ يَتَفَعْلَلُ | تَدَحْرَجَ يَتَدَحْرَجُ |
| IIIq | `form-3q` | `/arabic-verb-form/3q` | `f3-quadriliteral` | اِفْعَنْلَلَ يَفْعَنْلِلُ | اِحْرَنْجَمَ يَحْرَنْجِمُ |
| IVq | `form-4q` | `/arabic-verb-form/4q` | `f4-quadriliteral` | اِفْعَلَلَّ يَفْعَلِلُّ | اِقْشَعَرَّ يَقْشَعِرُّ |

IIIq has a second pattern for a root whose last radical is ي, `f3-quadriliteral-final-weak` (اِفْعَنْلَى يَفْعَنْلِي, example اِسْلَنْقَى يَسْلَنْقِي), added by `0082_quadriliteral_final_weak_engine.sql` and `0083_quadriliteral_final_weak_pattern.sql`
with the `radical4_kind` column of `schema.sql`; see "Final-weak four-radical roots" below.

**Schema.** `morph_pattern.radical_count` and `morph_pattern_resolution.radical_count` are `smallint NOT NULL DEFAULT 3`;
every earlier row keeps 3. Three checks tie the column to the data: `chk_morph_pattern_radical_count` (3 or 4),
`chk_morph_pattern_radical_count_rules` (a pattern has `radical_count = 4` exactly when its `rules` contain the
placeholder `{4}`) and `chk_morph_pattern_quadriliteral_shape` (a four-radical pattern has sound radical kinds and no
gemination). `unique_morph_pattern_resolution_key` includes `radical_count`, and `trg_sync_morph_pattern_resolution`
also follows edits of the column. The pattern form of Iq has the vowels a ~ i only because the existing check ties the
vowels to form 1.

**Final-weak four-radical roots.** `radical4_kind` (`radical_kind NOT NULL DEFAULT 'sound'`, on `morph_pattern` and on
`morph_pattern_resolution`) is the kind of the last radical. `chk_morph_pattern_radical4_kind` allows `sound`, `waw` and
`ya` and only on a pattern of four radicals; a hamza as the last radical is a sound letter for the resolver, as before.
`chk_morph_pattern_quadriliteral_shape` is unchanged, so the first three radicals of a four-radical pattern stay sound.
`unique_morph_pattern_resolution_key` and `trg_sync_morph_pattern_resolution` include the column, and `0082` redefines
the trigger function, `add_morph_pattern_resolution` and `resolve_morph_pattern_id` (each keeps its single signature) and
adds `classify_quadriliteral_radical4(root)`, the kind of the fourth letter of a four-letter root. `0083` inserts the
pattern `f3-quadriliteral-final-weak` with `radical4_kind = 'ya'`; the trigger registers its shape, so a root with a final
ya takes it in form IIIq and still takes no pattern in the other forms.

The pattern spells every person out (`no_affix`), as the final-weak form VII does. The rule `{4}` is the radical where the
stem keeps it (اِسْلَنْقَيْتُ, يَسْلَنْقِي, اِسْلَنْقِيَا) and is absent where it does not (اِسْلَنْقَى, يَسْلَنْقِ); a ي that is
the ending of the second person feminine is written as a letter. This is also what `chk_morph_pattern_radical_count_rules`
asks of a four-radical pattern. A final و is written ي in the derived forms (Wright §169), so only the ya shape is
registered: no conjugation table of a waw root exists, and the resolver returns no pattern for one instead of
guessing. The pattern has the passive participle (مُغْرَنْدًى, printed by the table of اغرندى) and no passive voice.

**Generation.** The generators keep their signatures and read the radical count from the rules
(`rules_radical_count`: `{4}` present means four): `replace_root_placeholders(template, c1, c2, c3, c4 DEFAULT NULL)`
writes the fourth radical, `build_person_forms_from_affixes` takes `p_c4`, and `prepared_affix_rules(form,
radical_count DEFAULT 3)` reads the affix rows through `affix_form_for`, which reuses the rows of an existing form
instead of repeating them: Iq takes the damma prefixes of form 2, IIq the rows of form 5, IIIq those of form 7 and IVq
has no affix rows (like form IX it spells every person out). A hamza as the fourth radical is seated like any other
(`canonical_hamza_root` runs over `{4}` too). `require_radical_count(root, n)` refuses a root of another length
(`22023`); an entry with a pattern needs a root of the pattern's radical count, the regeneration paths only pair a
pattern with entries whose cleaned root has that many letters, and a pattern update never touches an entry of the
other radical count. `classify_root` is unchanged and refuses four letters.

**Resolution.** `resolve_morph_pattern_id(..., target_radical_count)` resolves every four-letter root to the sound
shape, because a weak letter before the last radical is a consonant in the four-radical forms (سَيْطَرَ, هَرْوَلَ,
وَسْوَسَ, طَمْأَنَ conjugate like دَحْرَجَ). A root whose last radical is و or ي is final-weak: a ya resolves to
`f3-quadriliteral-final-weak` in form IIIq and to NULL in the other forms, a waw to NULL in every form (an override
still wins). `describe_quadriliteral_root` labels a root (`quadriliteral`,
`final-weak`, `hamzated`, `reduplicated`) for the admin form. An override only applies to patterns of the radical
count that was asked for.

`0081` also inserts four anchor rows in `lexical_pattern_override` (دحرج for forms 1 and 2, حرجم for form 3, قشعر for form
4) and `0083` a fifth (سلقي for the final-weak pattern of form 3). They change no result, because the shape resolves
anyway; they exist so that `tests/paradigm/goldens.test.ts`, which renders every pattern with the root of its first
override, finds a four-letter root for the quadriliteral patterns.

**Adding a quadriliteral pattern.** As in "Adding a pattern", with `radical_count = 4`, the three radical kinds `sound`
and `is_geminate = FALSE`, `radical4_kind` `sound` (the default), `waw` or `ya`, and `{4}` in the rules. Forms of other
numbers need `affix_form_for` to know which affix rows they take. `add_morph_pattern_resolution` needs a four-letter
example root for such a pattern; the kind of its last letter is the shape it registers.

**Sources.** The paradigms are those of the Wiktionary conjugation tables of the four forms (the revisions are in the
fixtures) and Wright, vol. I, §§67-72, 118, 169 and 203. The final-weak pattern is checked cell by cell against the
tables of the four final-weak IIIq verbs of Wiktionary (اِسْلَنْقَى, اِسْرَنْدَى, اِغْرَنْدَى, اِغْلَنْثَى); its categories of Iq,
IIq and IVq verbs (fetched 2026-10-14) hold no final-weak verb, so a final-weak four-letter root has no pattern in those
forms. Not produced: the omission of one of the two ت of the second form (Wright §118 rem. a), which no table prints.
The second and third jussive spellings of form IVq and a second masdar are alternative forms (see "Alternative forms").

**Passive.** The first form has a passive (`0084`; `0065` makes `regenerate_passive_conjugations` take the root length from
the pattern instead of fixing it at three): `passive_perfect` `{1}ُ{2}ْ{3}ِ{4}` and `passive_imperfect_stem`
`{1}َ{2}ْ{3}َ{4}` give دُحْرِجَ / يُدَحْرَجُ, as in the tables of the 11 verbs of the first form whose table has a full passive,
and as Wright §118 and §107 lead one to expect (the form is inflected like the second form of the triliteral, whose passive
the derived forms share). The other three forms get none: their tables give an impersonal passive (11 of 13) or none, and
Wright §118 inflects them like forms V, VII and IX. Two tables print a full passive (اِغْرَنْدَى of IIIq and اِشْمَأَزَّ of IVq)
because their page asks for one; Wright 73 and 110 give forms VII and IX no passive, so they are not shipped. Like every
pattern that carries a passive, the first form needs the entry's `no_passive` for the verbs whose table gives none or an
impersonal one (عَرْبَدَ, قَهْقَهَ, عَسْعَسَ | ثَرْثَرَ, وَسْوَسَ, سَيْطَرَ).

## Entry slugs

`/entry/<slug>` is the address of an entry page. The slug is `lexical_entry.slug`, derived from `text` by the immutable
function `entry_slug(text)`. `normalized_text` is unchanged and keeps serving search (prefix, trigram and vector
matching); it is no longer used to build URLs.

`entry_slug` applies these steps in order:

1. NFKC normalisation (presentation forms become base letters, fullwidth forms become ASCII, ligatures expand) and
   lower case. Case mapping is the database's `lower()`.
2. Typographic Arabic variants are folded: Persian yeh U+06CC to U+064A, Persian kaf U+06A9 to U+0643, alef wasla
   U+0671 to U+0627. Hamza forms (أ إ آ ؤ ئ ء), ta marbuta and alef maksura are **not** folded: they distinguish
   different words, and entries whose text reduces to the same slug share one page, as homographs do.
3. Tatweel, the Arabic diacritics (U+0610-U+061A, U+064B-U+065F, U+0670) and the Quranic annotation marks are removed.
4. Whitespace, underscores and dashes (hyphen-minus is kept as is; U+2010-U+2015 and U+2212 count as dashes) become a
   hyphen.
5. Punctuation and symbols are removed: ASCII punctuation, Latin-1 punctuation, general punctuation (including zero
   width and bidirectional marks), currency and arrow blocks, Arabic punctuation, CJK punctuation and emoji. Letters,
   digits (ASCII and Arabic-Indic) and combining marks of every script stay.
6. Runs of hyphens collapse and edge hyphens are trimmed, then the result is normalised to NFKC once more so that the
   function returns its own output unchanged.

The removed and replaced characters are written as explicit code point ranges inside the function, never as
`[[:punct:]]`-style classes, so the result does not depend on the database locale.

| text | slug |
| --- | --- |
| `to write` | `to-write` |
| `a lot` and `alot` | `a-lot` and `alot` |
| `Wi-Fi واي فاي` | `wi-fi-واي-فاي` |
| `كَتَبَ` | `كتب` |
| `ٱبْن` (alef wasla) | `ابن` |
| `أكل`, `اكل`, `إكل`, `آكل` | four different slugs |
| `???` | `e-<id>` |

`lexical_entry.slug` is `NOT NULL` with a btree index (`idx_lexical_entry_slug`). A `BEFORE INSERT OR UPDATE OF id, text,
slug` trigger always sets it to `lexical_entry_slug(id, text)`, which is `entry_slug(text)` or `e-<id>` when nothing is
left of the text, so a slug written by hand is overwritten and the column cannot drift from `text`. (An entry whose text
is literally `e-12` shares a slug with the fallback of entry 12; the page then lists both.)

### Old URLs

A request for `/entry/<key>` is answered in this order:

1. A verified entry with `slug = key`: the page. A slug always wins over everything below.
2. Otherwise `resolve_entry_slug_redirect(key)` returns a slug and the page answers a permanent redirect (308) to
   `/entry/<that slug>`. It looks, in this order, at
   1. `entry_slug_redirect.old_slug = key` (an address that an entry used to have),
   2. a verified entry whose `normalized_text = key` (the address every entry had before slugs existed). When several
      entries share the key the one with the lowest id decides,
   3. a verified entry whose slug is `entry_slug(key)`, which sends `/entry/To-Write` or an unnormalised Arabic
      spelling to the canonical address.
3. Otherwise 404.

The common case is one indexed query; the redirect query runs only when the slug is unknown, and every branch of it is
an index lookup (`entry_slug_redirect` primary key, `idx_lexical_entry_normalized_text`, `idx_lexical_entry_slug`).

`entry_slug_redirect(old_slug, lexical_entry_id, created_at)` is filled by an `AFTER UPDATE` trigger. When an edit
changes an entry's slug or `normalized_text`, both old values become rows that point at the entry (and so follow it
through later renames, without chains). A value is not recorded while another entry still uses it as a slug or as a
`normalized_text`, and rows are removed again when their value becomes live: a new entry, or a rename, that takes
the slug or the `normalized_text` deletes the row. Deleting an entry deletes its rows (`ON DELETE CASCADE`). Only
verified entries are redirect targets.

### Schema and backfill

`schema.sql` creates `lexical_entry.slug` as a nullable column, `entry_slug_redirect`, and the two relation views with
`target_slug` as their last column. `0040_entry_slug.sql` then defines the functions, installs the slug trigger,
backfills every row with `lexical_entry_slug(id, text)`, sets the column to `NOT NULL` and installs the redirect
triggers. The table is empty when the script runs, so the backfill does nothing measurable. No redirect rows exist in a
new database: every `normalized_text` address is served by the lookup above.

### Changing the rules

To change the rules, edit `entry_slug` in `0040`. A database that holds entries slugged by the old rules is brought
in line with `UPDATE lexical_entry SET slug = slug;`: the trigger recomputes each slug and the redirect trigger keeps
every slug that changed alive.

### TypeScript mirror

`src/lib/slug.ts` implements the same steps for code that has to build a slug without the database (the appendix links
verb forms to entries). `tests/integration/entry-slug-mirror.test.ts` runs 20,000 generated strings and every Unicode
code point through the function and the mirror and compares the results. Code points that only one side knows because
the Unicode versions of PostgreSQL and Node differ are tolerated (63 on PostgreSQL 16, none on PostgreSQL 18).

## Regeneration

Derived data (masdar, participles, conjugation rows, `search_vector`) is regenerated by triggers:

- inserting an entry, or changing its `root`, `morph_pattern_id`, `morphology_overrides` or `text`, regenerates that
  entry (`regenerate_derived_stems_for_entry`, row trigger);
- an `UPDATE` of `morph_pattern` fires one statement-level trigger with transition tables. It compares old and new
  rows and regenerates only the entries of patterns whose `rules`, `form_number` or `no_affix` changed, all of them in
  one pass (`regenerate_derived_stems`, batches of 500). When only the verbal noun templates (`masdar`,
  `active_participle`, `passive_participle`) changed, the conjugation rows are left alone and only the stems and
  search vectors are rewritten. Editing a description, the vocalic template or the radical kinds regenerates nothing;
- `regenerate_derived_stems` rewrites only the conjugation rows and entries whose values differ, inserts missing rows
  in generation order and deletes stale ones;
- `generate_conjugation_rows` reads `affix_rules` once per call (`prepared_affix_rules`), not once per mood.

Measured on PostgreSQL 16 with 6,500 entries (6,000 with a pattern, 342,000 conjugation rows), median backend CPU
time of five runs, each inside a rolled-back transaction (`f2` has 373 entries):

| operation | before | after |
| --- | ---: | ---: |
| update `f2` rules, masdar only | 595 ms | 68 ms |
| update `f2` rules, perfect template | 634 ms | 365 ms |
| update `f2`, `f3`, `f5` rules in one statement | 1,826 ms | 1,169 ms |
| update `f2` without changing its output | 571 ms | 0.3 ms |
| insert one entry | 2.3 ms | 2.1 ms |
| change one entry's root | 2.4 ms | 2.3 ms |
| insert 1,000 entries in one statement | 2,019 ms | 1,807 ms |

A change to a conjugation template still costs about 1 ms per entry. Most of it is work the output requires:
generating and normalizing 57 forms, rewriting the changed conjugation rows, the Arabic stemmer for the new search
vector, and the entry row update, which maintains three GIN indexes.

### Cost of the passive voice

Measured on PostgreSQL 18.6 (`postgres:18-trixie` in a container, default settings: `shared_buffers` 128 MB, `work_mem`
4 MB, `fsync` on) on a laptop with an AMD Ryzen 7 PRO 8840U (8 cores, 16 threads) and 14 GiB of memory, with nothing else
running. Three databases hold the same 100,000 entries with sound roots on 14 patterns (22,000 on `f1-a-u`, 15,000 on `f2`,
12,000 on `f1-a-i`, 10,000 on `f1-i-a`, 8,000 on `f4`, 6,000 each on `f5`, `f8` and `f10`, and fewer on the others):

- A: the scripts before the passive voice (`0001`-`0055`);
- B: all scripts, with the five passive keys removed from every pattern, so no passive rows exist and the other changes
  since A (quadriliteral engine, alternative forms, radical counts) are the only difference;
- C: all scripts as they are now.

A and B hold 5,700,000 conjugation rows (774 MB with indexes, 899 MB for the database); C holds 10,640,000, of which
4,940,000 are passive (1,426 MB and 1,551 MB). Each figure is the median of three runs in a rolled-back transaction in a
fresh session, as printed by `\timing` (elapsed time, not the backend CPU time of the table above); the three rows for a
single entry are the median of five runs in one session after one warm-up run.

| operation | A | B | C |
| --- | ---: | ---: | ---: |
| `regenerate_all_derived_stems()`, 100,000 entries | 53.6 s | 55.9 s | 95.7 s |
| update `f2` rules (15,000 entries), masdar only | 2.3 s | 2.1 s | 3.3 s |
| update `f2` rules, perfect template | 9.2 s | 9.3 s | 15.5 s |
| update `f2` rules, passive perfect template | n/a | n/a | 15.4 s |
| update `f2`, `f3`, `f5` rules in one statement (26,000 entries), perfect template | 16.1 s | 16.2 s | 27.0 s |
| update `f2` without changing its output | 1.9 ms | 2.1 ms | 2.2 ms |
| insert one entry | 1.5 ms | 2.0 ms | 2.9 ms |
| change one entry's root | 1.6 ms | 2.1 ms | 2.8 ms |
| insert 1,000 entries in one statement | 1.0 s | 1.3 s | 2.2 s |

The passive voice adds about 0.9 ms to saving an entry and about 0.4 ms to every entry of a pattern whose template
changes (1.03 ms per entry against 0.62 ms). A change to either voice regenerates both, so editing only a passive
template costs as much as editing the perfect. A masdar-only change does not regenerate conjugations, but it rewrites the
search vector, which reads every conjugation row of the entry: 109 rows instead of 57, hence 3.3 s against 2.1 s. The
other work since A costs about 30% more per single entry and 4% more for a full regeneration.

A template change is about 1 ms per entry, so a single pattern holding
more than about 55,000 entries would take longer than the 60 s that nginx waits for the application by default. At 22,000
entries, the largest pattern here, no figure is unreasonable for an administrative operation, so no lazier design is
proposed. If a pattern ever grows that large, run the edit from `psql`.

Inserting many entries in one transaction into a database whose `conjugation` table is still empty is quadratic. In a
freshly built database, one statement inserting 3,000 entries took 78.6 s (26 ms per entry), against 2.1 ms per entry
once the table held rows. `regenerate_passive_conjugations` is declared `plan_cache_mode = force_generic_plan`; its
generic plan is made at the first call of the session, when `conjugation` is empty, and joins the `updated` step to a
sequential scan of the whole table, which is then repeated for every entry. A session that starts, or is invalidated by
an `ANALYZE`, when the table already holds rows plans a nested loop on the primary key. Load large batches in
transactions of a few thousand entries with `ANALYZE` in between, as was done for the figures above. A fix is proposed,
not built: drop the `updated` step and let the `inserted` step take the rows that differ
(`WHERE m.existing_id IS NULL OR m.existing_form IS DISTINCT FROM m.form`); its `ON CONFLICT` clause already updates the
row. On a scratch database the same 3,000 entries then took 6.6 s. `regenerate_derived_stems` has the same `updated`
step for the active voice; it is reached by set-based calls (pattern updates, `regenerate_all_derived_stems`), which did
not show the problem here.

`tests/integration/derived-equivalence.test.ts` builds a fixed corpus of 110 entries covering every seeded pattern,
the Form VIII assimilation roots, hamzated and weak roots on sound patterns, every override key and entries without
a pattern. It checks a digest of each entry's derived data against `tests/golden/derived-corpus.txt` after insertion
and after every regeneration path (full regeneration, multi-row pattern updates of conjugation and verbal noun
templates, updates that change nothing, root, override and text changes). The golden was written before the
regeneration rework and has not changed since. Regenerate it with `UPDATE_GOLDENS=1` only when generated output is
meant to change, and say why in the commit.

## Root spelling

A root is stored as `strip_root_noise` returns it (`src/lib/validation/root.ts` `normalizeRoot` is the TypeScript
mirror, compared against it over 20,000 generated strings): the string is NFC-normalised, then diacritics, tatweel,
joiners, spaces and hyphens are removed and alef maksura (ى) is written as ya (ي). A bare alef (ا) is kept so that a
noun root can contain it, but `require_radical_count(root, n)` (`require_triliteral_root` is its wrapper for `n = 3`),
which the generators and `classify_root` call, refuses it with SQLSTATE 22023 because alef is never a radical of a
verb: write the weak radical as و or ي. `0053` folds the roots already stored in `lexical_entry` and
`lexical_pattern_override` once; a stored root that contains a bare alef is left for a human.

## Hamza seating

A hamza radical is a bare hamza (ء) inside the generators, whichever of ء أ إ آ ؤ ئ the root was typed with:
`replace_root_placeholders` canonicalises it with `canonical_hamza_root`, and `resolve_morph_pattern_id` finds an override
the same way. The seat of each bare hamza is decided afterwards, on the finished word, by
`normalize_arabic_hamza_seating_bare` (a SQL wrapper that returns the input when it holds no bare hamza, and the
PL/pgSQL `seat_bare_hamzas` otherwise). The rules are Wright §§131-135: the stronger of the hamza's own vowel and the
vowel before it decides the seat (kasra over damma over fatha); a final hamza takes the seat of the vowel before it, or
stays on the line after a long vowel or sukun; after a long ā or ū the hamza stays on the line unless its vowel is
damma (after ā) or kasra; after ya it sits on ya. The table is in `tests/COVERAGE.md` ("Hamza canonicalisation").

Because the seat depends on the finished word, a template never spells a hamza radical's seat: it writes `{n}`, and
a pattern for a shape with a hamza radical must carry the placeholder in every rule (`tests/invariants/pattern-data.test.ts`).
A sound pattern therefore serves the hamzated shapes of its form and vowels once `add_morph_pattern_resolution` maps them,
and the generators need no pattern of their own for them. A quiescent hamza that follows the hamza of a prefix is
merged into the prefix's long vowel by `normalize_arabic_hamza_assimilation` (آمَنَ, أُومِنُ, إِيمَان).

## Passive voice

`conjugation.voice` is part of the unique key, and a pattern can carry the passive next to the active templates. The rule
keys are `passive_perfect`, `passive_imperfect_stem` and the per-mood alternatives `passive_imperfect_indicative`,
`passive_imperfect_subjunctive` and `passive_imperfect_jussive`. Each is a template string or a per-person object, and
follows the rules of its active counterpart (a stem cannot be combined with explicit moods, a `no_affix` pattern spells
every key out per person, a hamza radical is written as its placeholder). There is no passive imperative: Wright 101 uses
the jussive instead. `src/lib/validation/morphPatternRules.ts` validates the keys and the pattern editor edits them.

- **Generation.** `generate_passive_rows(root, rules, form_number, overrides, no_affix)` and
  `generate_passive_rows_from_affixes(...)` rename the passive keys to their active names (`passive_rules_as_active`),
  run `generate_conjugation_rows_from_affixes` on them with the affix rows of form 2 (`prepared_passive_affix_rules`),
  and return `(mood, person_forms)` like the active generators. The passive imperfect takes the damma prefixes of form 2
  for every form (`يُكْتَبُ`); the passive perfect takes the suffixes of `affix_rules` form 0. Anything the active generator
  learns (orthography, the Form VIII assimilation of `{1}ْت`, more radicals) therefore reaches the passive too. One rule is
  the generator's own: a vowelless ya after damma is written waw (`passive_vowelless_ya_after_damma`, Wright 147), so a
  ya-first root gets `يُوسَرُ` from the sound template and form X gets `اُسْتُوقِظَ`.
- **Storage.** `regenerate_passive_conjugations(entry_ids)` upserts the `voice = 'passive'` rows by `(mood, person)`,
  deletes the ones that no longer apply and stores nothing for an entry whose `morphology_overrides` has
  `"no_passive": true`. `regenerate_derived_stems` and `regenerate_derived_stems_for_entry` call it after the active
  step and no longer touch rows of another voice. Passive forms enter the search vector like every other conjugation
  row, and `lexical_entry_derived_status.conjugation_count` counts both voices.
- **Adding a passive to a pattern** is data: a guarded update in a numbered script, written once per group of patterns so
  that the pattern trigger regenerates the entries of the group in one pass.

  ```sql
  UPDATE morph_pattern mp
  SET rules = mp.rules || v.passive
  FROM (VALUES
    ('f1-a-u', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb)
  ) AS v(code, passive)
  WHERE mp.id = morph_pattern_id_for_code(v.code)
    AND NOT has_passive_rules(mp.rules);
  ```

  Write the expected passive paradigm first from a Wiktionary conjugation table (`tests/fixtures/passive-paradigms-*.ts`,
  asserted by `tests/paradigm/passive-paradigms.test.ts`), then the template. `tests/integration/passive-pattern-data.test.ts`
  pins the shape of the rules, `tests/paradigm/passive-sweep.test.ts` generates the passive of every swept root, and
  `tests/integration/passive-storage.test.ts` checks the stored rows, `no_passive` and the preview path.
- **Which patterns.** Forms I to VI, VIII and X, and the first form of the sound quadriliteral verb (`0084`), carry a passive wherever a Wiktionary table gives a full passive. Forms VII
  and IX do not (neutral or reflexive verbs: Wright 73 and 110, and every table of the sources says "impersonal passive" or
  "no passive"), nor do the u ~ u verbs of form I (verbs of state, Wright 73), the lexical strong-inflection patterns, and the
  form VI patterns of final-weak, geminate and hamzated-third verbs for which the sources only give an impersonal passive.
  The pattern carries the passive for every verb it serves; the entry's `no_passive` decides, as for the passive participle.
  Impersonal passives (the third masculine singular of an intransitive verb) are not generated by any pattern.
- **`no_passive`: when to set it.** The pattern gives its passive to every verb it serves, so the entry has to opt out. Set
  `morphology_overrides.no_passive` (the "No passive voice" box of the entry form) for a verb that has no personal passive:
  an intransitive verb, a verb of state (Wright 73), or a verb whose Wiktionary table says "no passive" or lists only the
  impersonal third masculine singular. It removes the `voice = 'passive'` rows and the passive participle (and wins over
  `passive_participle_override`), and nothing else: the active paradigm is untouched. Unchecking it brings the rows back.
  Among the sourced tables, 60 verbs with an impersonal passive and 22 with none sit on a pattern that generates a full
  passive (أَبَقَ, أَذِنَ, يَبِسَ, نَامَ, مَشَى, تَغَيَّرَ, اِتَّصَلَ, ثَرْثَرَ | يَتَمَ, يَقِظَ, تَكَوَّنَ, تَوَجَّهَ, اِتَّجَهَ, عَرْبَدَ); an entry for any of
  them needs the flag, and `tests/integration/passive-storage.test.ts` checks that it leaves their active rows and no passive
  row. No script sets it: the repository holds no production data, so the flag is set per entry in the admin form.

## Reference data notes

**Affix rows of forms III and IV.** `affix_rules` stores the imperfect affixes per form. Forms II, III and IV share the
damma prefixes and forms I, V, VI, VII, VIII and X share the fatha prefixes, so forms III and IV repeat form II row for
row (and forms V to X repeat form I). The rows stay as they are: an alias mechanism would change how the generators
look up affixes, for no change in output, and these 78 rows are not editable in the admin UI. Instead,
`tests/invariants/affix-rules.test.ts` fails if a form III or IV row stops being a copy of form II, next to the
existing invariants that pin the fatha forms to form I.

**Form VIII final-weak ya and waw.** `f8-final-weak-ya` and `f8-final-weak-waw` have identical templates, and so do the
form IV and X pairs. This is correct: in the derived forms a final waw is inflected like a final ya (Wright, vol. 1,
verbs with a weak third radical). The vendored appendix says the same for form X: defective roots inflect as -ā/-ī
defectives (اِسْتَثْنَى, اِسْتَوْلَى), without distinguishing waw from ya. `tests/integration/form-viii-final-weak.test.ts`
checks اِشْتَرَى (ya) and اِرْتَجَى (waw) against expected forms and keeps the three pairs identical. Merging each pair
into one pattern that resolves both shapes is now possible with `add_morph_pattern_resolution`, but it would move
existing entries to another pattern id, so it is left as a deliberate data change.

**Participle overrides.** `lexical_entry.morphology_overrides` is a JSON object read by `generate_verbal_nouns`:

| key | effect |
| --- | --- |
| `masdar_override` | replaces the generated masdar |
| `active_participle_override` | replaces the generated active participle |
| `passive_participle_override` | replaces the generated passive participle |
| `no_passive` | `true` stores no passive participle, even if an override is set, and no passive conjugation rows |

An override is stored after `normalize_arabic_orthography` (no Form VIII assimilation is applied to it), only where the
pattern has a template for that noun, and an empty string is stored as an empty string. Removing the key restores the
generated value, and overrides survive every regeneration. `tests/integration/participle-overrides.test.ts` pins this.
The admin form does not offer the two participle keys yet; live data may already use them, so the SQL keeps reading them.

**Sense context tags.** `sense.context_tags` is not added to the search vector. The vector belongs to the entry while
tags belong to one sense, so sense search would return every sense of an entry for one sense's tag. All current
lexemes also carry the default weight D, so tags at weight C would rank above a match on the headword
(`ts_rank` weighs D 0.1 and C 0.2). Doing this properly means weighting the headword and forms too, which changes every
stored vector and the ranking of every query. Tags are matched with the existing GIN index instead:
`WHERE context_tags @> ARRAY['legal']`.

**Entries that need attention.** The view `lexical_entry_derived_status` has one row per entry: `has_pattern`,
`has_verbal_nouns`, `conjugation_count` and `needs_attention`. `needs_attention` is true when an entry has a pattern but
no conjugation rows: no root, or a root whose length is not its pattern's radical count. Use it for an admin filter:
`SELECT lexical_entry_id FROM lexical_entry_derived_status WHERE needs_attention`. An entry whose root has
another number of radicals than the pattern's `radical_count` gets its derived forms cleared instead of generated from a
truncated root, and has to be corrected by hand; list such entries with:

```sql
SELECT le.id, le.text, le.root
FROM lexical_entry le
JOIN morph_pattern mp ON mp.id = le.morph_pattern_id
WHERE char_length(strip_root_noise(le.root)) <> mp.radical_count;
```

**`0008` and `0009`.** `0008` repairs pattern data that only databases built from an earlier `0004` had; in a new
database its updates match nothing. `0009` is required: it splits the hamzated-middle pattern into a shape pattern and
a lexical one and adds the override for رأي. Both end with `regenerate_all_derived_stems()`, which has no entries to
process when the database is built.
