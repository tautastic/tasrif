# Findings

Defects found in the SQL engine and its reference data, with what was done about each. How to apply the fixes to a
deployed database is in [`db/README.md`](../db/README.md); the tests that hold each fix in place are named below.

## Fixed

| Id | Defect | Fix | Held by |
| --- | --- | --- | --- |
| DB-1 | Form VIII had no assimilation: `صبر` gave `اِصْتَبَرَ`, `زهر` gave `اِزْتَهَرَ`, `ذكر` gave `اِذْتَكَرَ`, in every mood, in the masdar and in both participles. | `assimilate_form_viii_infix` rewrites the infixed ta before the placeholders are filled, for the generators and therefore for stored entries and the pattern preview alike. | `tests/paradigm/assimilation.test.ts`, `tests/fixtures/assimilation.ts` |
| DB-2 | The Form I `i ~ i` active participle template was the colour/defect adjective `أَفْعَل` (`أَحْسَب`). | Template repaired to `فَاعِل`, guarded on the old value, followed by a full regeneration. | `tests/paradigm/verbal-nouns.test.ts`, `golden/paradigms/form-01-i-i.txt` |
| DB-3 | Roots were stored raw and sliced with `SUBSTRING`, so `ك ت ب` or a leading space produced garbage and a four-letter root was silently truncated. | A BEFORE trigger stores the cleaned root, the generators work from it and raise `22023` unless it has three radicals, and a pattern cannot be attached to any other root. `lexical_pattern_override.root` is cleaned the same way. | `tests/integration/root-normalization.test.ts` |
| DB-4 | No index for the entry page lookup, the second `UNION` branch of the views or their cascades; two indexes duplicated unique constraints. | `idx_lexical_entry_normalized_text`, `_prefix` (text_pattern_ops), `_trgm`, `idx_sense_relation_sense_id_2`, `idx_translation_link_ar_sense_id`; `idx_conjugation_entry` and `idx_form_number` dropped. | `tests/integration/indexes.test.ts` |
| DB-6 | Every search vector used the `arabic` configuration, English included. | `build_search_vector` uses `english` for English entries and `arabic` otherwise. | `tests/integration/search-vector.test.ts` |
| DB-7 | The views collapsed distinct targets that share a `normalized_text`, so saving an entry in the editor deleted the hidden links. | Both views dedupe by target sense (and relation type) and keep their columns and ordering. | `tests/integration/relation-views.test.ts` |
| DB-8 | A NULL affix voided a whole mood without an error. | Columns are `NOT NULL DEFAULT ''` and the functions coalesce anyway. | `tests/invariants/affix-rules.test.ts` |
| DB-9 | A bare imperative template in no_affix mode produced thirteen persons. | The imperative is restricted to the second persons. | `tests/paradigm/conjugation.test.ts` |
| DB-10 | Regeneration updated each entry twice and deleted and re-inserted every conjugation row. | One `UPDATE` sets the stems and the search vector; conjugations are upserted and only stale rows are deleted. | `tests/integration/regeneration.test.ts` |
| DB-10 | Every edit of a pattern regenerated all of its entries row by row, even when nothing that affects the output changed, and `affix_rules` was read once per mood. | A statement-level trigger with transition tables regenerates, in one pass, only the entries of patterns whose rules, form or `no_affix` changed, and only their stems when only verbal noun templates changed; writes skip unchanged rows; affixes are read once per call; normalization skips its hamza steps for strings without hamza. | `tests/integration/derived-equivalence.test.ts`, `golden/derived-corpus.txt`, `tests/invariants/orthography-chain.test.ts` |
| DB-11 | `db/0005_add_affix_rules.sql` had no final semicolon. | Added. | harness |
| DB-11 | Data scripts identified patterns by their editable `description`. | `morph_pattern.code`, unique and immutable, and `morph_pattern_resolution`, one row per (root shape, verb form choice) with a unique key. | `tests/integration/pattern-identity.test.ts`, `tests/invariants/pattern-data.test.ts` |
| DB-11 | `active_participle_override` and `passive_participle_override` were read but unpinned. | Behaviour pinned and documented in `db/README.md`. | `tests/integration/participle-overrides.test.ts` |
| DB-11 | Entries with a pattern but no derived forms were invisible. | View `lexical_entry_derived_status` with `needs_attention`. | `tests/integration/derived-status.test.ts` |
| DB-14 | `/entry/<normalized_text>` stripped spaces and punctuation, so `to write` became `towrite` and distinct phrases collided (`a lot`, `alot`). | `lexical_entry.slug` from `entry_slug()`, a 308 for every old URL (old `normalized_text`, renamed slugs, other spellings) through `entry_slug_redirect`, and every link, sitemap entry and revalidation using the slug. | `tests/integration/entry-slug*.test.ts`, `tests/unit/entry-page.test.ts`, `tests/unit/entry-slug.test.ts` |
| INF-4 | `db/0000_truncate_data.sql` wiped every table whenever it was applied. | Removed with the migration machinery: the database is built once from `db/schema.sql` and the numbered scripts. | harness |

## Behaviour that changed on purpose

- Giving an entry a morphological pattern and a root that is not exactly three radicals now fails with SQLSTATE `22023`
  instead of storing garbage stems. An entry with a pattern and no root at all is still accepted and has no derived data.
- `generate_verbal_nouns` and `generate_conjugation_rows` raise `22023` for a root that is not three radicals once it is
  cleaned, so the pattern preview reports it.
- The `i ~ i` paradigm golden changed in one line, the active participle.

## Known and not fixed

- Form VIII for `ظ` and `ذ` has three attested spellings (for example `اِظَّلَمَ`, `اِطَّلَمَ`, `اِظْطَلَمَ`); the engine
  produces one, `اِظْطَلَمَ` and `اِدَّكَرَ`. The other spellings are not offered as alternatives.
- The cells still without a sourced table, each with its reason in "Not covered, and why" in
  [`COVERAGE.md`](COVERAGE.md): hamzated-first and hamzated-third form IX; hollow + hamzated-third forms VII and IX and
  the other hollow classes with a hamza; form VII of assimilated roots and form IX of assimilated and geminate roots
  (the Wiktionary categories are empty); the remaining doubly weak combinations of a hamzated radical with a
  final-weak ya; عَيِيَ and the rest of the حيي class; وَطِئَ; the hollow verbs inflected as strong beyond the
  eight with a table; a second verb of one root, form and vowel class other than جوب form X; and the
  alternative seats of the final hamza that Wright leaves open. A form with no table that checks it is not added.
- Pattern edits still regenerate synchronously inside the admin's transaction; a change to a conjugation template costs
  about 1 ms per entry (see "Regeneration" in `db/README.md`).
- `sense.context_tags` is deliberately not part of the search vector (see `db/README.md`).
- Forms III and IV repeat the form II affix rows, and the waw and ya final-weak patterns of forms IV, VIII and X are
  identical; both are deliberate and guarded by tests (see `db/README.md`).
