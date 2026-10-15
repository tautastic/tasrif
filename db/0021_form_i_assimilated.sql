INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f1-a-i-assimilated-waw',
        1,
        'فَعَلَ',
        'a ~ i, assimilated waw',
        '{
          "masdar": "{1}َ{2}ْ{3}",
          "perfect": "{1}َ{2}َ{3}",
          "imperative": "{2}ِ{3}",
          "imperfect_stem": "{2}ِ{3}",
          "active_participle": "{1}َا{2}ِ{3}",
          "passive_participle": "مَ{1}ْ{2}ُو{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'waw',
        'sound',
        'sound',
        FALSE,
        'a',
        'i');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f1-a-a-assimilated-waw',
        1,
        'فَعَلَ',
        'a ~ a, assimilated waw',
        '{
          "masdar": "{1}َ{2}ْ{3}",
          "perfect": "{1}َ{2}َ{3}",
          "imperative": "{2}َ{3}",
          "imperfect_stem": "{2}َ{3}",
          "active_participle": "{1}َا{2}ِ{3}",
          "passive_participle": "مَ{1}ْ{2}ُو{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'waw',
        'sound',
        'sound',
        FALSE,
        'a',
        'a');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f1-i-i-assimilated-waw',
        1,
        'فَعِلَ',
        'i ~ i, assimilated waw',
        '{
          "masdar": "{1}َ{2}ْ{3}",
          "perfect": "{1}َ{2}ِ{3}",
          "imperative": "{2}ِ{3}",
          "imperfect_stem": "{2}ِ{3}",
          "active_participle": "{1}َا{2}ِ{3}",
          "passive_participle": "مَ{1}ْ{2}ُو{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'waw',
        'sound',
        'sound',
        FALSE,
        'i',
        'i');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f1-i-a-assimilated-waw',
        1,
        'فَعِلَ',
        'i ~ a, assimilated waw',
        '{
          "perfect": "{1}َ{2}ِ{3}",
          "imperative": "اِي{2}َ{3}",
          "imperfect_stem": "{1}ْ{2}َ{3}",
          "active_participle": "{1}َا{2}ِ{3}",
          "passive_participle": "مَ{1}ْ{2}ُو{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'waw',
        'sound',
        'sound',
        FALSE,
        'i',
        'a');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f1-u-u-assimilated',
        1,
        'فَعُلَ',
        'u ~ u, assimilated',
        '{
          "masdar": "{1}ُ{2}ْ{3}",
          "perfect": "{1}َ{2}ُ{3}",
          "imperative": "اُو{2}ُ{3}",
          "imperfect_stem": "{1}ْ{2}ُ{3}",
          "active_participle": "{1}َ{2}ِي{3}",
          "passive_participle": "مَ{1}ْ{2}ُو{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'waw',
        'sound',
        'sound',
        FALSE,
        'u',
        'u');

SELECT add_morph_pattern_resolution('f1-u-u-assimilated', 'يسر');

SELECT add_morph_pattern_resolution('f1-a-i', 'يتم');

SELECT add_morph_pattern_resolution('f1-a-a', 'ينع');

SELECT add_morph_pattern_resolution('f1-i-a', 'يبس');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f1-i-a-assimilated-waw-waw-elided',
        1,
        'فَعِلَ',
        'i ~ a, assimilated waw, waw elided',
        '{
          "masdar": "{2}َ{3}َة",
          "perfect": "{1}َ{2}ِ{3}",
          "imperative": "{2}َ{3}",
          "imperfect_stem": "{2}َ{3}",
          "active_participle": "{1}َا{2}ِ{3}",
          "passive_participle": "مَ{1}ْ{2}ُو{3}"
        }'::jsonb,
        FALSE,
        TRUE,
        'waw',
        'sound',
        'sound',
        FALSE,
        'i',
        'a');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('وسع', 1, 'i', 'a', morph_pattern_id_for_code('f1-i-a-assimilated-waw-waw-elided'),
        'وَسِعَ drops its و in the imperfect and imperative (يَسَعُ, سَعْ) although its imperfect vowel is a, Wright vol. I §144.');
