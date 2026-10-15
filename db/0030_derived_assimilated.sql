SELECT add_morph_pattern_resolution('f5', 'وقع');

SELECT add_morph_pattern_resolution('f5', 'يسر');

SELECT add_morph_pattern_resolution('f6', 'وصل');

SELECT add_morph_pattern_resolution('f6', 'يسر');

SELECT add_morph_pattern_resolution('f2', 'يسر');

SELECT add_morph_pattern_resolution('f3', 'يسر');

SELECT add_morph_pattern_resolution('f10', 'يقظ');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f8-assimilated-waw',
        8,
        'اِفْتَعَلَ',
        'assimilated waw',
        '{
          "masdar": "اِتِّ{2}َا{3}",
          "perfect": "اِتَّ{2}َ{3}",
          "imperative": "اِتَّ{2}ِ{3}",
          "imperfect_stem": "تَّ{2}ِ{3}",
          "active_participle": "مُتَّ{2}ِ{3}",
          "passive_participle": "مُتَّ{2}َ{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'waw',
        'sound',
        'sound',
        FALSE,
        NULL,
        NULL);

SELECT add_morph_pattern_resolution('f8-assimilated-waw', 'يسر');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f10-assimilated-waw',
        10,
        'اِسْتَفْعَلَ',
        'assimilated waw',
        '{
          "masdar": "اِسْتِي{2}َا{3}",
          "perfect": "اِسْتَ{1}ْ{2}َ{3}",
          "imperative": "اِسْتَ{1}ْ{2}ِ{3}",
          "imperfect_stem": "سْتَ{1}ْ{2}ِ{3}",
          "active_participle": "مُسْتَ{1}ْ{2}ِ{3}",
          "passive_participle": "مُسْتَ{1}ْ{2}َ{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'waw',
        'sound',
        'sound',
        FALSE,
        NULL,
        NULL);
