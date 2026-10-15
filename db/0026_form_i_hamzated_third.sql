INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f1-a-a-hamzated-third',
        1,
        'فَعَلَ',
        'a ~ a, hamzated third',
        '{
          "perfect": "{1}َ{2}َ{3}",
          "imperative": "اِ{1}ْ{2}َ{3}",
          "imperfect_stem": "{1}ْ{2}َ{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'sound',
        'sound',
        'hamza',
        FALSE,
        'a',
        'a');
