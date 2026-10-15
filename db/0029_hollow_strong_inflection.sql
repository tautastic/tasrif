INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f1-i-a-hollow-waw-strong-inflection',
        1,
        'فَعِلَ',
        'i ~ a, hollow waw, strong inflection',
        '{
          "masdar": "{1}َ{2}َ{3}",
          "perfect": "{1}َ{2}ِ{3}",
          "imperative": "اِ{1}ْ{2}َ{3}",
          "imperfect_stem": "{1}ْ{2}َ{3}",
          "active_participle": "أَ{1}ْ{2}َ{3}"
        }'::jsonb,
        FALSE,
        TRUE,
        'sound',
        'waw',
        'sound',
        FALSE,
        'i',
        'a');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('عور', 1, 'i', 'a', morph_pattern_id_for_code('f1-i-a-hollow-waw-strong-inflection'),
        'عَوِرَ يَعْوَرُ (to be one-eyed) is inflected like a strong verb, Wright vol. I §160.');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('حول', 1, 'i', 'a', morph_pattern_id_for_code('f1-i-a-hollow-waw-strong-inflection'),
        'حَوِلَ يَحْوَلُ (to squint) is inflected like a strong verb, Wright vol. I §160; حَالَ يَحُولُ (a ~ u) stays hollow.');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f8-hollow-strong-inflection',
        8,
        'اِفْتَعَلَ',
        'hollow, strong inflection',
        '{
          "masdar": "اِ{1}ْتِ{2}َا{3}",
          "perfect": "اِ{1}ْتَ{2}َ{3}",
          "imperative": "اِ{1}ْتَ{2}ِ{3}",
          "imperfect_stem": "{1}ْتَ{2}ِ{3}",
          "active_participle": "مُ{1}ْتَ{2}ِ{3}",
          "passive_participle": "مُ{1}ْتَ{2}َ{3}"
        }'::jsonb,
        FALSE,
        TRUE,
        'sound',
        'waw',
        'sound',
        FALSE,
        NULL,
        NULL);

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('زوج', 8, NULL, NULL, morph_pattern_id_for_code('f8-hollow-strong-inflection'),
        'اِزْدَوَجَ (to be paired) has only the strong inflection in form VIII, Wright vol. I §162.');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('جور', 8, NULL, NULL, morph_pattern_id_for_code('f8-hollow-strong-inflection'),
        'اِجْتَوَرَ (to be neighbours) has only the strong inflection in form VIII, Wright vol. I §162.');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f10-hollow-strong-inflection',
        10,
        'اِسْتَفْعَلَ',
        'hollow, strong inflection',
        '{
          "masdar": "اِسْتِ{1}ْ{2}َا{3}",
          "perfect": "اِسْتَ{1}ْ{2}َ{3}",
          "imperative": "اِسْتَ{1}ْ{2}ِ{3}",
          "imperfect_stem": "سْتَ{1}ْ{2}ِ{3}",
          "active_participle": "مُسْتَ{1}ْ{2}ِ{3}",
          "passive_participle": "مُسْتَ{1}ْ{2}َ{3}"
        }'::jsonb,
        FALSE,
        TRUE,
        'sound',
        'waw',
        'sound',
        FALSE,
        NULL,
        NULL);

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('حوذ', 10, NULL, NULL, morph_pattern_id_for_code('f10-hollow-strong-inflection'),
        'اِسْتَحْوَذَ (to gain the mastery over) takes the strong inflection in form X, Wright vol. I §163.');
