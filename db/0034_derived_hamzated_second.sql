SELECT add_morph_pattern_resolution('f3', 'سأل');

SELECT add_morph_pattern_resolution('f6', 'سأل');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f5-hamzated-second',
        5,
        'تَفَعَّلَ',
        'hamzated second',
        '{
          "perfect": "تَ{1}َ{2}َّ{3}",
          "imperative": "تَ{1}َ{2}َّ{3}",
          "imperfect_stem": "تَ{1}َ{2}َّ{3}",
          "passive_participle": "مُتَ{1}َ{2}َّ{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'sound',
        'hamza',
        'sound',
        FALSE,
        NULL,
        NULL);
