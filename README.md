# Tasrif

A morphological engine for Arabic verbs, with an English–Arabic dictionary
interface built on top.

The user interface is modelled on [Wiktionary](https://en.wiktionary.org),
which is dual-licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and the
[GFDL](https://www.gnu.org/licenses/fdl-1.3.html). The content of the
"Appendix:Arabic verbs" page is adapted from its counterpart there.

## Features

- **Arabic root-and-pattern morphology** — entries are linked to a triliteral
  root and a morphological pattern (form I–X, etc.), yielding verbal noun,
  active participle, passive participle, and full conjugations.
- **Automatic conjugation tables** — from a root and selected pattern, the
  engine generates the complete paradigm: perfective, imperfective indicative,
  subjunctive, jussive, imperative, active and passive participles, and verbal
  noun, across all persons, genders, and numbers.
- **Orthographically aware generation** — the engine does not apply templates
  naively. It normalises Arabic orthography after generation, handling hamza
  seating, initial hamza, alef maqsura, tatweel, gemination, assimilation, and
  long vowels. This makes final-weak, hollow, geminate, and hamzated verbs come
  out correctly.
- **Morphological overrides** — supports irregular dual, plural, and elative
  forms, maṣdar overrides, and suppression of the passive participle.
- **English–Arabic dictionary** — lexical entries and senses with parts of
  speech, definitions, examples, translations, and semantic relations such as
  synonym, antonym, hyponym, hypernym, and near synonym.
- **Search and browsing** — full-text and trigram search over entries,
  normalised text, derived stems, participles, and conjugations; browse by
  language, root, recent entries, or random entries.
- **Administration** — create, edit, and delete entries; manage senses,
  translations, semantic relations, and morphological overrides.

## Planned Features

- **Passive voice** — full conjugation of the passive, across all moods,
  persons, genders, and numbers.
- **Expanded verb morphology** — forms XI–XV and quadriliteral patterns
  (Iq–IVq), extending derivational coverage beyond the triliteral system.
- **Additional overrides** — further irregular forms and exception handling.

## Morphological Engine

Arabic verb morphology is treated as a system of roots, patterns, stems, and
affixes. Each pattern supplies a vocalic template and rules for the perfective,
imperfective moods, imperative, participles, and verbal noun. Affix rules then
fill the person, gender, and number slots.

Because Arabic orthography is context-sensitive, the engine applies a
normalisation layer after template substitution. This corrects forms that would
be wrong if the rules were followed mechanically. The result is a
complete, readable conjugation table for each verb entry.

## AI Disclaimer

Claude Code has been used very sparingly in this project, mainly to help write the test suite.

## License

Two licences apply, file by file.

**MIT** ([LICENSE-CODE](LICENSE-CODE)) covers everything not listed below: the application code, the SQL and
the morphology engine, the Docker, nginx and fail2ban configuration, the test code, the generated test
goldens under `tests/golden/`, and the documentation.

**CC BY-SA 4.0** ([LICENSE-WIKTIONARY](LICENSE-WIKTIONARY)) covers the material adapted from Wiktionary's
["Appendix:Arabic verbs"](https://en.wiktionary.org/wiki/Appendix:Arabic_verbs), as its ShareAlike clause
requires. Under the licence, anyone who redistributes or adapts these files must keep them under CC BY-SA 4.0
and credit Wiktionary:

- `src/content/appendix/arabic-verbs.json`: the prose, examples and table of the appendix, adapted.
- `tests/fixtures/assimilation.ts`: every fixture takes its expected forms and rule description from the
  appendix (each `source` field cites it).
- `tests/fixtures/paradigms.ts`: six of the eleven fixtures (forms I, II, V, VIII and X) take their expected
  forms from the appendix; the other five cite W. Wright's grammar. The file is distributed as a whole under
  CC BY-SA 4.0 because it contains the appendix-derived fixtures.
- `tests/fixtures/weak-paradigms-form-1.ts`, `weak-paradigms-forms-2-5.ts`, `weak-paradigms-forms-6-10.ts`: the finite
  forms of every fixture are transcribed from the Wiktionary conjugation table of the verb (each `source` field names
  the page and the revision), so the files are distributed under CC BY-SA 4.0.
- `tests/fixtures/passive-paradigms-form-1.ts`, `passive-paradigms-form-1q.ts`, `passive-paradigms-forms-2-5.ts`,
  `passive-paradigms-forms-6-10.ts`, `passive-absent.ts`, `quad-paradigms-form-1q.ts`, `quad-paradigms-forms-2q-4q.ts`, `quad-paradigms-final-weak.ts`,
  `alternatives-cells.ts` and `tests/integration/variants-data.ts`: the passive, four-radical and alternative forms are
  transcribed from the same Wiktionary conjugation tables (each `source` field names the page and the revision), so
  these files are distributed under CC BY-SA 4.0 as well.

The golden files under `tests/golden/` are output generated by the engine from synthetic roots. The appendix
has no person-by-person paradigms (it holds prose, examples and one vowel table), so they are not adapted from
it and are MIT.
