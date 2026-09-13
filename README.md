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

## License

Everything in this repository is licensed under the
[MIT License](LICENSE-CODE), with a single exception:

- **`src/content/appendix/arabic-verbs.json`** — adapted from Wiktionary's
  ["Appendix:Arabic verbs"](https://en.wiktionary.org/wiki/Appendix:Arabic_verbs)
  and licensed under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), as required
  by its ShareAlike clause. See [LICENSE-WIKTIONARY](LICENSE-WIKTIONARY).