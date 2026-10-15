INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f8-hamza-assimilated',
        8,
        'اِفْتَعَلَ',
        'hamza assimilated',
        '{
          "masdar": "اِتِّ{2}َا{3}",
          "perfect": "اِتَّ{2}َ{3}",
          "imperative": "اِتَّ{2}ِ{3}",
          "imperfect_stem": "تَّ{2}ِ{3}",
          "active_participle": "مُتَّ{2}ِ{3}",
          "passive_participle": "مُتَّ{2}َ{3}"
        }'::jsonb,
        FALSE,
        TRUE,
        'hamza',
        'sound',
        'sound',
        FALSE,
        NULL,
        NULL);

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('أخذ', 8, NULL, NULL, morph_pattern_id_for_code('f8-hamza-assimilated'),
        'اِتَّخَذَ assimilates its first radical to the ت of form VIII (for اِئْتَخَذَ), Wright vol. I §139.');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('ءخذ', 8, NULL, NULL, morph_pattern_id_for_code('f8-hamza-assimilated'),
        'the same verb with its first radical typed as a bare hamza');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f4-final-weak-hamzated-middle-hamza-elided',
        4,
        'أَفْعَلَ',
        'final-weak, hamzated middle, hamza elided',
        '{
          "masdar": "إِ{1}َاءَة",
          "active_participle": "مُ{1}ٍ",
          "passive_participle": "مُ{1}ًى",
          "perfect": {
            "first_person_singular": "أَ{1}َيْتُ",
            "second_person_masculine_singular": "أَ{1}َيْتَ",
            "second_person_feminine_singular": "أَ{1}َيْتِ",
            "third_person_masculine_singular": "أَ{1}َى",
            "third_person_feminine_singular": "أَ{1}َتْ",
            "second_person_dual": "أَ{1}َيْتُمَا",
            "third_person_masculine_dual": "أَ{1}َيَا",
            "third_person_feminine_dual": "أَ{1}َتَا",
            "first_person_plural": "أَ{1}َيْنَا",
            "second_person_masculine_plural": "أَ{1}َيْتُمْ",
            "second_person_feminine_plural": "أَ{1}َيْتُنَّ",
            "third_person_masculine_plural": "أَ{1}َوْا",
            "third_person_feminine_plural": "أَ{1}َيْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "أَ{1}ِ",
            "second_person_feminine_singular": "أَ{1}ِي",
            "second_person_dual": "أَ{1}ِيَا",
            "second_person_masculine_plural": "أَ{1}ُوا",
            "second_person_feminine_plural": "أَ{1}ِينَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أُ{1}ِي",
            "second_person_masculine_singular": "تُ{1}ِي",
            "second_person_feminine_singular": "تُ{1}ِينَ",
            "third_person_masculine_singular": "يُ{1}ِي",
            "third_person_feminine_singular": "تُ{1}ِي",
            "second_person_dual": "تُ{1}ِيَانِ",
            "third_person_masculine_dual": "يُ{1}ِيَانِ",
            "third_person_feminine_dual": "تُ{1}ِيَانِ",
            "first_person_plural": "نُ{1}ِي",
            "second_person_masculine_plural": "تُ{1}ُونَ",
            "second_person_feminine_plural": "تُ{1}ِينَ",
            "third_person_masculine_plural": "يُ{1}ُونَ",
            "third_person_feminine_plural": "يُ{1}ِينَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أُ{1}ِيَ",
            "second_person_masculine_singular": "تُ{1}ِيَ",
            "second_person_feminine_singular": "تُ{1}ِي",
            "third_person_masculine_singular": "يُ{1}ِيَ",
            "third_person_feminine_singular": "تُ{1}ِيَ",
            "second_person_dual": "تُ{1}ِيَا",
            "third_person_masculine_dual": "يُ{1}ِيَا",
            "third_person_feminine_dual": "تُ{1}ِيَا",
            "first_person_plural": "نُ{1}ِيَ",
            "second_person_masculine_plural": "تُ{1}ُوا",
            "second_person_feminine_plural": "تُ{1}ِينَ",
            "third_person_masculine_plural": "يُ{1}ُوا",
            "third_person_feminine_plural": "يُ{1}ِينَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أُ{1}ِ",
            "second_person_masculine_singular": "تُ{1}ِ",
            "second_person_feminine_singular": "تُ{1}ِي",
            "third_person_masculine_singular": "يُ{1}ِ",
            "third_person_feminine_singular": "تُ{1}ِ",
            "second_person_dual": "تُ{1}ِيَا",
            "third_person_masculine_dual": "يُ{1}ِيَا",
            "third_person_feminine_dual": "تُ{1}ِيَا",
            "first_person_plural": "نُ{1}ِ",
            "second_person_masculine_plural": "تُ{1}ُوا",
            "second_person_feminine_plural": "تُ{1}ِينَ",
            "third_person_masculine_plural": "يُ{1}ُوا",
            "third_person_feminine_plural": "يُ{1}ِينَ"
          }
        }'::jsonb,
        TRUE,
        TRUE,
        'sound',
        'hamza',
        'ya',
        FALSE,
        NULL,
        NULL);

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('رأي', 4, NULL, NULL, morph_pattern_id_for_code('f4-final-weak-hamzated-middle-hamza-elided'),
        'أَرَى يُرِي (to show) drops the hamza of رَأَى throughout form IV, Wright vol. I §176.');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('رءي', 4, NULL, NULL, morph_pattern_id_for_code('f4-final-weak-hamzated-middle-hamza-elided'),
        'the same verb with its middle radical typed as a bare hamza');
