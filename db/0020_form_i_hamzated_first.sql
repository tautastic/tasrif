SELECT add_morph_pattern_resolution('f1-a-u', 'أمل');

SELECT add_morph_pattern_resolution('f1-a-i', 'أسر');

SELECT add_morph_pattern_resolution('f1-a-a', 'أذن');

SELECT add_morph_pattern_resolution('f1-i-a', 'أمن');

SELECT add_morph_pattern_resolution('f1-u-u', 'أنس');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f1-a-u-hamza-elided-in-the-imperative',
        1,
        'فَعَلَ',
        'a ~ u, hamza elided in the imperative',
        '{
          "masdar": "{1}َ{2}ْ{3}",
          "perfect": "{1}َ{2}َ{3}",
          "imperative": "{2}ُ{3}",
          "imperfect_stem": "{1}ْ{2}ُ{3}",
          "active_participle": "{1}َا{2}ِ{3}",
          "passive_participle": "مَ{1}ْ{2}ُو{3}"
        }'::jsonb,
        FALSE,
        TRUE,
        'hamza',
        'sound',
        'sound',
        FALSE,
        'a',
        'u');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('أكل', 1, 'a', 'u', morph_pattern_id_for_code('f1-a-u-hamza-elided-in-the-imperative'),
        'أَكَلَ drops its first radical in the imperative (كُلْ), Wright vol. I §137; the rest of the paradigm is that of the hamzated-first shape.');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('ءكل', 1, 'a', 'u', morph_pattern_id_for_code('f1-a-u-hamza-elided-in-the-imperative'),
        'the same verb with its first radical typed as a bare hamza');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('أخذ', 1, 'a', 'u', morph_pattern_id_for_code('f1-a-u-hamza-elided-in-the-imperative'),
        'أَخَذَ drops its first radical in the imperative (خُذْ), Wright vol. I §137.');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('ءخذ', 1, 'a', 'u', morph_pattern_id_for_code('f1-a-u-hamza-elided-in-the-imperative'),
        'the same verb with its first radical typed as a bare hamza');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('أمر', 1, 'a', 'u', morph_pattern_id_for_code('f1-a-u-hamza-elided-in-the-imperative'),
        'أَمَرَ makes its imperative مُرْ, Wright vol. I §137 (وَأْمُرْ after wa, §138).');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('ءمر', 1, 'a', 'u', morph_pattern_id_for_code('f1-a-u-hamza-elided-in-the-imperative'),
        'the same verb with its first radical typed as a bare hamza');
