SELECT add_morph_pattern_resolution('f2', 'وحد');

SELECT add_morph_pattern_resolution('f3', 'وصل');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f4-assimilated',
        4,
        'أَفْعَلَ',
        'assimilated',
        '{
          "masdar": "إِي{2}َا{3}",
          "perfect": "أَ{1}ْ{2}َ{3}",
          "imperative": "أَ{1}ْ{2}ِ{3}",
          "imperfect_stem": "و{2}ِ{3}",
          "active_participle": "مُو{2}ِ{3}",
          "passive_participle": "مُو{2}َ{3}"
        }'::jsonb,
        FALSE,
        FALSE,
        'waw',
        'sound',
        'sound',
        FALSE,
        NULL,
        NULL);

SELECT add_morph_pattern_resolution('f4-assimilated', 'يقظ');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f4-assimilated-waw-final-weak',
        4,
        'أَفْعَلَ',
        'assimilated waw, final-weak',
        '{
          "masdar": "إِي{2}َاء",
          "perfect": {
            "first_person_singular": "أَ{1}ْ{2}َيْتُ",
            "second_person_masculine_singular": "أَ{1}ْ{2}َيْتَ",
            "second_person_feminine_singular": "أَ{1}ْ{2}َيْتِ",
            "third_person_masculine_singular": "أَ{1}ْ{2}َى",
            "third_person_feminine_singular": "أَ{1}ْ{2}َتْ",
            "second_person_dual": "أَ{1}ْ{2}َيْتُمَا",
            "third_person_masculine_dual": "أَ{1}ْ{2}َيَا",
            "third_person_feminine_dual": "أَ{1}ْ{2}َتَا",
            "first_person_plural": "أَ{1}ْ{2}َيْنَا",
            "second_person_masculine_plural": "أَ{1}ْ{2}َيْتُمْ",
            "second_person_feminine_plural": "أَ{1}ْ{2}َيْتُنَّ",
            "third_person_masculine_plural": "أَ{1}ْ{2}َوْا",
            "third_person_feminine_plural": "أَ{1}ْ{2}َيْنَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أُو{2}ِي",
            "second_person_masculine_singular": "تُو{2}ِي",
            "second_person_feminine_singular": "تُو{2}ِينَ",
            "third_person_masculine_singular": "يُو{2}ِي",
            "third_person_feminine_singular": "تُو{2}ِي",
            "second_person_dual": "تُو{2}ِيَانِ",
            "third_person_masculine_dual": "يُو{2}ِيَانِ",
            "third_person_feminine_dual": "تُو{2}ِيَانِ",
            "first_person_plural": "نُو{2}ِي",
            "second_person_masculine_plural": "تُو{2}ُونَ",
            "second_person_feminine_plural": "تُو{2}ِينَ",
            "third_person_masculine_plural": "يُو{2}ُونَ",
            "third_person_feminine_plural": "يُو{2}ِينَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أُو{2}ِيَ",
            "second_person_masculine_singular": "تُو{2}ِيَ",
            "second_person_feminine_singular": "تُو{2}ِي",
            "third_person_masculine_singular": "يُو{2}ِيَ",
            "third_person_feminine_singular": "تُو{2}ِيَ",
            "second_person_dual": "تُو{2}ِيَا",
            "third_person_masculine_dual": "يُو{2}ِيَا",
            "third_person_feminine_dual": "تُو{2}ِيَا",
            "first_person_plural": "نُو{2}ِيَ",
            "second_person_masculine_plural": "تُو{2}ُوا",
            "second_person_feminine_plural": "تُو{2}ِينَ",
            "third_person_masculine_plural": "يُو{2}ُوا",
            "third_person_feminine_plural": "يُو{2}ِينَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أُو{2}ِ",
            "second_person_masculine_singular": "تُو{2}ِ",
            "second_person_feminine_singular": "تُو{2}ِي",
            "third_person_masculine_singular": "يُو{2}ِ",
            "third_person_feminine_singular": "تُو{2}ِ",
            "second_person_dual": "تُو{2}ِيَا",
            "third_person_masculine_dual": "يُو{2}ِيَا",
            "third_person_feminine_dual": "تُو{2}ِيَا",
            "first_person_plural": "نُو{2}ِ",
            "second_person_masculine_plural": "تُو{2}ُوا",
            "second_person_feminine_plural": "تُو{2}ِينَ",
            "third_person_masculine_plural": "يُو{2}ُوا",
            "third_person_feminine_plural": "يُو{2}ِينَ"
          },
          "imperative": {
            "second_person_masculine_singular": "أَ{1}ْ{2}ِ",
            "second_person_feminine_singular": "أَ{1}ْ{2}ِي",
            "second_person_dual": "أَ{1}ْ{2}ِيَا",
            "second_person_masculine_plural": "أَ{1}ْ{2}ُوا",
            "second_person_feminine_plural": "أَ{1}ْ{2}ِينَ"
          },
          "active_participle": "مُو{2}ٍ",
          "passive_participle": "مُو{2}ًى"
        }'::jsonb,
        TRUE,
        FALSE,
        'waw',
        'sound',
        'ya',
        FALSE,
        NULL,
        NULL);
