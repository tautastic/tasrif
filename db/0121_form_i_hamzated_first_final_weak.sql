INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
SELECT 'f1-a-a-final-weak-hamzated-first',
       1,
       base.vocalic_template,
       'a ~ a, final-weak, hamzated first',
       base.rules || jsonb_build_object('masdar', 'إِ{2}َاء'),
       base.no_affix,
       TRUE,
       'hamza',
       'sound',
       'ya',
       FALSE,
       'a',
       'a'
FROM morph_pattern base
WHERE base.code = 'f1-a-a-final-weak';

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
SELECT 'f1-a-i-hollow-waw-final-weak-hamzated-first',
       1,
       base.vocalic_template,
       'a ~ i, hollow waw, final-weak, hamzated first',
       base.rules || jsonb_build_object('masdar', 'إِ{2}ِ{3}ّ'),
       base.no_affix,
       TRUE,
       'hamza',
       'waw',
       'ya',
       FALSE,
       'a',
       'i'
FROM morph_pattern base
WHERE base.code = 'f1-a-i-hollow-waw-final-weak';

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('أبي', 1, 'a', 'a', morph_pattern_id_for_code('f1-a-a-final-weak-hamzated-first'),
        'أَبَى يَأْبَى (to refuse) takes the verbal noun إِبَاء instead of the فَعْل of the shape, as the Wiktionary conjugation table of the verb prints it; the rest of the paradigm is that of the final-weak a ~ a shape, Wright vol. I §§164-169.'),
       ('أوي', 1, 'a', 'i', morph_pattern_id_for_code('f1-a-i-hollow-waw-final-weak-hamzated-first'),
        'أَوَى يَأْوِي (to take shelter) takes the verbal noun إِوِيّ instead of the schematic one of the hollow-waw final-weak shape, as the Wiktionary conjugation table of the verb prints it; the rest of the paradigm is that of that shape with a hamza as its first radical, Wright vol. I §§131-135, 164-169.');

INSERT INTO morph_pattern_alternative_noun (morph_pattern_id, root, noun, ordinal, template, verbatim, note)
VALUES (morph_pattern_id_for_code('f1-a-a-final-weak-hamzated-first'), 'أبي', 'masdar', 1, 'إِ{2}َاءَة', FALSE,
        'The Wiktionary conjugation table of أَبَى (a ~ a) prints the verbal nouns إِبَاء and إِبَاءَة.'),
       (morph_pattern_id_for_code('f1-a-i-hollow-waw-final-weak-hamzated-first'), 'أوي', 'masdar', 1, 'أُ{2}ِ{3}ّ', FALSE,
        'The Wiktionary conjugation table of أَوَى prints the verbal nouns إِوِيّ, أُوِيّ and إِوَاء.'),
       (morph_pattern_id_for_code('f1-a-i-hollow-waw-final-weak-hamzated-first'), 'أوي', 'masdar', 2, 'إِ{2}َاء', FALSE,
        'The Wiktionary conjugation table of أَوَى prints the verbal nouns إِوِيّ, أُوِيّ and إِوَاء.');
