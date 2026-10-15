# Testing the Postgres morphology engine

The logic under test is the SQL functions and triggers in the numbered `db/` scripts (listed in
`golden/function-inventory.txt`), plus the reference data they read (`morph_pattern`, `morph_pattern_resolution`,
`affix_rules`, `lexical_pattern_override`). Nothing here mocks the database: every
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

## Layout

```
tests/
  harness/      database template, per-file clones, snapshot and assertion helpers
  fixtures/     Tier A: sourced expectations (see "The three tiers of truth")
  golden/       Tier B: generated, reviewed output
  invariants/   Tier C: properties over every pattern, rule and affix row
  unit/         server actions, queries, components and pages against a clone, no browser
  integration/  SQL functions, triggers and regeneration
  paradigm/     cell-by-cell comparison of generated paradigms with the fixtures, and the sweeps
  corpus/       replay of a production dump (opt in)
e2e/            Playwright suite against the production build (see "End-to-end tests")
```

The files added with the passive voice, four-radical verbs, pattern variants and alternative forms:

| area | fixtures | `paradigm/` | `integration/` | `unit/` | `e2e/specs/` |
| --- | --- | --- | --- | --- | --- |
| passive voice | `passive-paradigms.ts` with `passive-paradigm-types.ts`, `passive-paradigms-form-1.ts`, `-form-1q.ts`, `-forms-2-5.ts`, `-forms-6-10.ts`, `passive-absent.ts` | `passive-paradigms.test.ts`, `passive-sweep.test.ts`, `passive-harness.ts` | `passive-pattern-data.test.ts`, `passive-storage.test.ts` | `passive-conjugation-table.test.ts`, `passive-preview-action.test.ts` | `passive.public.spec.ts` |
| four-radical verbs | `quad-paradigms.ts`, `quad-paradigms-form-1q.ts`, `-forms-2q-4q.ts`, `-final-weak.ts`, `quad-sweep-roots.ts` | `quad-paradigms.test.ts`, `quad-sweep.test.ts` | `quad-engine.test.ts`, `quad-final-weak.test.ts`, `quad-resolution.test.ts` | `quad-flows.test.ts`, `quad-public.test.ts`, `quad-validation.test.ts` | `quad-alternatives.stateful.spec.ts` |
| pattern variants | `integration/variants-data.ts` | | `variants-sql.test.ts` | `variants-actions.test.ts` | `variants.stateful.spec.ts` |
| alternative forms | `alternatives-cells.ts` | `alternatives-sources.test.ts` (the printed cells and verbal nouns of every sourced table against what an entry gets) | `alternatives-sql.test.ts`, `alternative-nouns-sql.test.ts` | `alternatives-component.test.ts`, `alternatives-query.test.ts` | `quad-alternatives.stateful.spec.ts` |

The sourced cells of the later weak-verb patterns (`db/0110`-`db/0121`) are in the existing `weak-paradigms-*.ts` fixtures and
are asserted by `paradigm/weak-paradigms.test.ts` and `paradigm/weak-sweep.test.ts`.

## How isolation works

- The harness loads `db/schema.sql` then `db/NNNN_*.sql` into a **template database**, in the
  same order `docker/db/init.sh` uses. The files are executed one at a time and never concatenated.
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

Tier B alone locks in bugs, Tier A alone does not scale to every pattern, Tier C alone cannot tell
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
- **A new pattern, its resolution and its code**: follow "Adding a pattern" in [`db/README.md`](../db/README.md). Look
  patterns up with `findPatternByCode`, never by description, and give a test its own synthetic pattern (form I with
  the vowel pair `u ~ i`, description starting with `test only`) instead of relying on a shape staying unresolved.
- **A change to how derived data is regenerated**: `golden/derived-corpus.txt` must not change. It records a digest of
  every derived value of a fixed corpus; see "Regeneration" in [`db/README.md`](../db/README.md).
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

Testing this engine surfaced a number of real defects in the SQL and its reference data. They are listed with their fixes
in [FINDINGS.md](./FINDINGS.md). `db/schema.sql` and `db/*.sql` run only when a database is first built, which is described in
[`db/README.md`](../db/README.md).

## Licence

The test code is MIT, like the rest of the repository ([LICENSE-CODE](../LICENSE-CODE)). Some fixtures are
different, because they are adapted from Wiktionary's "Appendix:Arabic verbs" and therefore licensed under
[CC BY-SA 4.0](../LICENSE-WIKTIONARY):

- `tests/fixtures/assimilation.ts`: all eleven fixtures cite the appendix as their source.
- `tests/fixtures/paradigms.ts`: the six fixtures whose `source` starts with the appendix citation
  (`form-1-a-u-ktb`, `form-1-a-i-gsl`, `form-2-ktb`, `form-5-elm`, `form-8-frq`, `form-10-xdm`). The five
  fixtures that cite Wright's grammar were not taken from the appendix, but the file as a whole is
  distributed under CC BY-SA 4.0 because it contains the others.
- `tests/fixtures/weak-paradigms-form-1.ts`, `weak-paradigms-forms-2-5.ts` and `weak-paradigms-forms-6-10.ts`: the
  finite forms of every fixture are transcribed from the Wiktionary conjugation table of the verb named in its
  `source` field (page and revision).
- `tests/fixtures/passive-paradigms-form-1.ts`, `passive-paradigms-form-1q.ts`, `passive-paradigms-forms-2-5.ts`,
  `passive-paradigms-forms-6-10.ts`, `passive-absent.ts`, `quad-paradigms-form-1q.ts`, `quad-paradigms-forms-2q-4q.ts`, `quad-paradigms-final-weak.ts`,
  `alternatives-cells.ts` and `tests/integration/variants-data.ts`: transcribed from the Wiktionary conjugation tables
  named in their `source` fields (page and revision).

Everything else under `tests/` is MIT, including `tests/golden/`: the goldens are generated by the engine
from synthetic roots, and the appendix has no person-by-person paradigms to adapt them from. A new fixture
whose `source` is the appendix belongs on the CC BY-SA list above.

## End-to-end tests

`e2e/` holds a Playwright suite that drives the production build in a real browser: security and login behaviour,
the admin entry flows, the public pages and their metadata, entry slugs and redirects, search, the unsaved-changes
guard, the page cache, runtime `SITE_URL`, and axe checks on the main pages (including a 375 pixel viewport).

```sh
pnpm build            # the suite runs the standalone build in .next/standalone
pnpm e2e              # everything; pnpm e2e:fast skips the tests tagged @slow
pnpm e2e:build        # builds with placeholder database settings, then runs the suite
```

The global setup creates a fresh database from the test harness's template (so `TEST_DATABASE_URL` must point at a
PostgreSQL server, as for `pnpm test`), seeds a small fixed dataset, starts the standalone server on a free port
(`E2E_PORT` pins it) and drops the database again afterwards. The read-only specs (`*.public.spec.ts`) run in
parallel; the specs that change data (`*.stateful.spec.ts`) run afterwards in one worker against uniquely named data.
The browser is the pre-installed Chromium (`E2E_CHROMIUM_PATH` overrides the location); in CI the job installs it with
`pnpm exec playwright install --with-deps chromium`. Traces and screenshots of failures are written to
`e2e/.artifacts`, which is not committed.

Firefox is opt-in: `E2E_BROWSER=firefox pnpm e2e` runs the same specs in Firefox (installed by
`pnpm exec playwright install firefox`, or `E2E_FIREFOX_PATH=<executable>` names one). It is a run of its own with a fresh
database, not an addition to the Chromium run: the public specs expect the seeded data and the login limits of a new
server, and a Chromium run leaves both changed. The whole suite (252 tests) passes in Firefox. It was run against the build that
ships with Playwright 1.59.1 (revision 1511, taken from the Nix store without installing anything), while the project
pins 1.56.1 (revision 1495). Running it found a real defect, now fixed: the scrolling tables of the pattern preview were not
keyboard-focusable in Firefox (axe `scrollable-region-focusable`); they are now named, focusable regions like the tables of
an entry, and a Chromium test checks it.

WebKit is not supported by this suite. Playwright's WebKit runs the public specs that do not log in (159 of 209 pass), but
the session cookie of the admin is `Secure` and the suite serves the production build over plain HTTP, and WebKit does not
send a `Secure` cookie over HTTP, not even to `127.0.0.1` or `localhost`; all 50 specs that sign in fail on the redirect to
the login page. Running it would need the standalone server behind TLS in the global setup.
