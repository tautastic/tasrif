# Testing the Postgres morphology engine

The logic under test is the 28 SQL functions and 3 triggers in `db/0001`–`db/0009`, plus the
reference data they read (`morph_pattern`, `affix_rules`, `lexical_pattern_override`). Nothing here mocks the database: every
assertion runs against a real PostgreSQL 18 server with the repository's own schema loaded.

## Running

```sh
pnpm test                       # the whole suite, a few seconds
pnpm test:one tests/unit/orthography.test.ts   # one file (or several)
UPDATE_GOLDENS=1 pnpm test      # rewrite golden files after an intentional change
CORPUS=1 pnpm test:corpus       # replay a production dump (opt in, see below)
pnpm test:db:stop               # remove the reusable test container
```

The first run starts a `postgres:18-trixie` container named `tasrif-test-pg` and leaves it running,
so later runs take about a second. Set `TEST_DATABASE_URL` to use a server you already have (CI does
this with a service container) and Docker is never touched.

## How isolation works

- The harness loads `db/drizzle/*/migration.sql` then `db/*.sql` into a **template database**, in the
  same order `docker/db/init.sh` uses. The files are executed one at a time and never concatenated,
  because `db/0005_add_affix_rules.sql` ends without a trailing semicolon.
- The template is named after a hash of those SQL files, so it is rebuilt only when the SQL changes
  and is shared safely across concurrent runs via an advisory lock.
- Each **test file** gets its own database cloned from the template (`CREATE DATABASE … TEMPLATE`,
  around 100 ms), so files can run in parallel.
- Each **mutating test** runs inside `db.tx(...)`, which always rolls back.

Never assert on serial ids across runs, and never rely on `jsonb` key order.

## The three tiers of truth

The failure this suite is designed to avoid is a test that re-implements the engine in TypeScript and
then agrees with itself. Every expectation comes from exactly one of three places.

**Tier A — verified expectations.** `tests/fixtures/` holds hand-checked Arabic, each row carrying a
`source` field naming where it came from (the vendored Wiktionary appendix in
`src/content/appendix/`, or a grammar). Derive the form from the reference *first*, then run it. If
the engine disagrees, one of the two is wrong and that is the finding — never paste engine output
back into a fixture.

**Tier B — reviewed goldens.** `tests/golden/` holds generated output that a human has read and
committed: a full paradigm per `morph_pattern`, the resolution coverage matrix, and the schema
inventory. Every Arabic line carries its codepoints so a one-diacritic change is visible in
`git diff`.

**Tier C — invariants.** `tests/invariants/` holds properties that must hold for all inputs and that
enumerate from the database, so they keep covering new data as it is added.

Tier B alone locks in bugs, Tier A alone does not scale to 27 patterns, Tier C alone cannot tell
valid Arabic from nonsense. The three cover each other's blind spots.

## Adding to each tier

- **A new normalization case**: add a row to `tests/fixtures/orthography.ts`. Build strings by
  concatenating the named codepoint constants rather than pasting glyphs — a combining mark typed
  into a bidi-reordered source line is not reliably the codepoint you meant.
- **A new verified paradigm**: add an entry to `tests/fixtures/paradigms.ts` with its `source`, then
  assert it in `tests/paradigm/`.
- **A new `morph_pattern`**: nothing to wire up. The golden and invariant tests enumerate from the
  database, so a new pattern automatically demands a new golden file and is swept into the property
  checks. Run `UPDATE_GOLDENS=1 pnpm test`, then **read the generated paradigm** before committing.
- **A new pattern for one irregular verb**: mark the pattern `is_lexical` and add a
  `lexical_pattern_override` row for its root. The resolver skips lexical patterns when matching on
  shape, the goldens render such a pattern with its own verb rather than a synthetic root, and two
  invariants hold you to it — a lexical pattern with no override is unreachable, and a
  shape-resolvable pattern may not elide a hamza radical.
- **A new SQL function or trigger**: `tests/golden/function-inventory.txt` will go red. That is
  intentional — regenerate it and the diff becomes the review.

## When regenerating a golden is legitimate

Only when you can say what changed and why the new output is correct. `UPDATE_GOLDENS=1` rewrites the
files; the diff is the artefact a reviewer reads. A golden regenerated without reading it is worse
than no golden at all, because it converts a caught regression into a committed one.

## The corpus test

`tests/corpus/regression.test.ts` restores a production dump from `backups/` (gitignored, so the test
skips when absent), replays `regenerate_all_derived_stems()` with the current functions, and diffs the
result against what the dump stored. A difference means the engine's behaviour has drifted from the
data in production — entries would silently change the next time anyone edits them.

It is opt in (`CORPUS=1`) because it depends on a dump that is not in the repository.

## Findings

Testing this engine surfaced a number of real defects in the SQL and its reference data. The
mechanical ones are fixed and the rest are recorded in [FINDINGS.md](./FINDINGS.md), which also
carries the procedure for applying the fixes to an already-deployed database — `db/*.sql` runs only
on first init, so a live database needs `db/0008_repair_morphology_defects.sql` and
`db/0009_lexical_pattern_overrides.sql` applied by hand, after the drizzle migration they depend on.
