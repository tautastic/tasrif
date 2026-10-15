SELECT add_morph_pattern_resolution('f5', 'أكد');

SELECT add_morph_pattern_resolution('f6', 'أمر');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f10-hamzated-first',
        10,
        'اِسْتَفْعَلَ',
        'hamzated first',
        '{
          "perfect": "اِسْتَ{1}ْ{2}َ{3}",
          "imperative": "اِسْتَ{1}ْ{2}ِ{3}",
          "imperfect_stem": "سْتَ{1}ْ{2}ِ{3}",
          "active_participle": "مُسْتَ{1}ْ{2}ِ{3}",
          "passive_participle": "مُسْتَ{1}ْ{2}َ{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'hamza',
        'sound',
        'sound',
        FALSE,
        NULL,
        NULL);

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f5-hamzated-third',
        5,
        'تَفَعَّلَ',
        'hamzated third',
        '{
          "perfect": "تَ{1}َ{2}َّ{3}",
          "imperative": "تَ{1}َ{2}َّ{3}",
          "imperfect_stem": "تَ{1}َ{2}َّ{3}",
          "passive_participle": "مُتَ{1}َ{2}َّ{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'sound',
        'sound',
        'hamza',
        FALSE,
        NULL,
        NULL);

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f6-hamzated-third',
        6,
        'تَفَاعَلَ',
        'hamzated third',
        '{
          "perfect": "تَ{1}َا{2}َ{3}",
          "imperative": "تَ{1}َا{2}َ{3}",
          "imperfect_stem": "تَ{1}َا{2}َ{3}",
          "passive_participle": "مُتَ{1}َا{2}َ{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'sound',
        'sound',
        'hamza',
        FALSE,
        NULL,
        NULL);
