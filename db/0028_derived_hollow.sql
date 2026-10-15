SELECT add_morph_pattern_resolution('f2', 'قوم');

SELECT add_morph_pattern_resolution('f2', 'بين');

SELECT add_morph_pattern_resolution('f3', 'قوم');

SELECT add_morph_pattern_resolution('f3', 'بيع');

SELECT add_morph_pattern_resolution('f5', 'كون');

SELECT add_morph_pattern_resolution('f5', 'غير');

SELECT add_morph_pattern_resolution('f6', 'عون');

SELECT add_morph_pattern_resolution('f6', 'زيد');

SELECT add_morph_pattern_resolution('f9', 'سود');

SELECT add_morph_pattern_resolution('f9', 'بيض');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f4-hollow',
        4,
        'أَفْعَلَ',
        'hollow',
        '{
          "masdar": "إِ{1}َا{3}َة",
          "active_participle": "مُ{1}ِي{3}",
          "passive_participle": "مُ{1}َا{3}",
          "perfect": {
            "first_person_singular": "أَ{1}َ{3}ْتُ",
            "second_person_masculine_singular": "أَ{1}َ{3}ْتَ",
            "second_person_feminine_singular": "أَ{1}َ{3}ْتِ",
            "third_person_masculine_singular": "أَ{1}َا{3}َ",
            "third_person_feminine_singular": "أَ{1}َا{3}َتْ",
            "second_person_dual": "أَ{1}َ{3}ْتُمَا",
            "third_person_masculine_dual": "أَ{1}َا{3}َا",
            "third_person_feminine_dual": "أَ{1}َا{3}َتَا",
            "first_person_plural": "أَ{1}َ{3}ْنَا",
            "second_person_masculine_plural": "أَ{1}َ{3}ْتُمْ",
            "second_person_feminine_plural": "أَ{1}َ{3}ْتُنَّ",
            "third_person_masculine_plural": "أَ{1}َا{3}ُوا",
            "third_person_feminine_plural": "أَ{1}َ{3}ْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "أَ{1}ِ{3}ْ",
            "second_person_feminine_singular": "أَ{1}ِي{3}ِي",
            "second_person_dual": "أَ{1}ِي{3}َا",
            "second_person_masculine_plural": "أَ{1}ِي{3}ُوا",
            "second_person_feminine_plural": "أَ{1}ِ{3}ْنَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أُ{1}ِي{3}ُ",
            "second_person_masculine_singular": "تُ{1}ِي{3}ُ",
            "second_person_feminine_singular": "تُ{1}ِي{3}ِينَ",
            "third_person_masculine_singular": "يُ{1}ِي{3}ُ",
            "third_person_feminine_singular": "تُ{1}ِي{3}ُ",
            "second_person_dual": "تُ{1}ِي{3}َانِ",
            "third_person_masculine_dual": "يُ{1}ِي{3}َانِ",
            "third_person_feminine_dual": "تُ{1}ِي{3}َانِ",
            "first_person_plural": "نُ{1}ِي{3}ُ",
            "second_person_masculine_plural": "تُ{1}ِي{3}ُونَ",
            "second_person_feminine_plural": "تُ{1}ِ{3}ْنَ",
            "third_person_masculine_plural": "يُ{1}ِي{3}ُونَ",
            "third_person_feminine_plural": "يُ{1}ِ{3}ْنَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أُ{1}ِي{3}َ",
            "second_person_masculine_singular": "تُ{1}ِي{3}َ",
            "second_person_feminine_singular": "تُ{1}ِي{3}ِي",
            "third_person_masculine_singular": "يُ{1}ِي{3}َ",
            "third_person_feminine_singular": "تُ{1}ِي{3}َ",
            "second_person_dual": "تُ{1}ِي{3}َا",
            "third_person_masculine_dual": "يُ{1}ِي{3}َا",
            "third_person_feminine_dual": "تُ{1}ِي{3}َا",
            "first_person_plural": "نُ{1}ِي{3}َ",
            "second_person_masculine_plural": "تُ{1}ِي{3}ُوا",
            "second_person_feminine_plural": "تُ{1}ِ{3}ْنَ",
            "third_person_masculine_plural": "يُ{1}ِي{3}ُوا",
            "third_person_feminine_plural": "يُ{1}ِ{3}ْنَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أُ{1}ِ{3}ْ",
            "second_person_masculine_singular": "تُ{1}ِ{3}ْ",
            "second_person_feminine_singular": "تُ{1}ِي{3}ِي",
            "third_person_masculine_singular": "يُ{1}ِ{3}ْ",
            "third_person_feminine_singular": "تُ{1}ِ{3}ْ",
            "second_person_dual": "تُ{1}ِي{3}َا",
            "third_person_masculine_dual": "يُ{1}ِي{3}َا",
            "third_person_feminine_dual": "تُ{1}ِي{3}َا",
            "first_person_plural": "نُ{1}ِ{3}ْ",
            "second_person_masculine_plural": "تُ{1}ِي{3}ُوا",
            "second_person_feminine_plural": "تُ{1}ِ{3}ْنَ",
            "third_person_masculine_plural": "يُ{1}ِي{3}ُوا",
            "third_person_feminine_plural": "يُ{1}ِ{3}ْنَ"
          }
        }'::jsonb,
        TRUE,
        FALSE,
        'sound',
        'waw',
        'sound',
        FALSE,
        NULL,
        NULL);

SELECT add_morph_pattern_resolution('f4-hollow', 'فيد');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f7-hollow',
        7,
        'اِنْفَعَلَ',
        'hollow',
        '{
          "masdar": "اِنْ{1}ِيَا{3}",
          "active_participle": "مُنْ{1}َا{3}",
          "passive_participle": "مُنْ{1}َا{3}",
          "perfect": {
            "first_person_singular": "اِنْ{1}َ{3}ْتُ",
            "second_person_masculine_singular": "اِنْ{1}َ{3}ْتَ",
            "second_person_feminine_singular": "اِنْ{1}َ{3}ْتِ",
            "third_person_masculine_singular": "اِنْ{1}َا{3}َ",
            "third_person_feminine_singular": "اِنْ{1}َا{3}َتْ",
            "second_person_dual": "اِنْ{1}َ{3}ْتُمَا",
            "third_person_masculine_dual": "اِنْ{1}َا{3}َا",
            "third_person_feminine_dual": "اِنْ{1}َا{3}َتَا",
            "first_person_plural": "اِنْ{1}َ{3}ْنَا",
            "second_person_masculine_plural": "اِنْ{1}َ{3}ْتُمْ",
            "second_person_feminine_plural": "اِنْ{1}َ{3}ْتُنَّ",
            "third_person_masculine_plural": "اِنْ{1}َا{3}ُوا",
            "third_person_feminine_plural": "اِنْ{1}َ{3}ْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "اِنْ{1}َ{3}ْ",
            "second_person_feminine_singular": "اِنْ{1}َا{3}ِي",
            "second_person_dual": "اِنْ{1}َا{3}َا",
            "second_person_masculine_plural": "اِنْ{1}َا{3}ُوا",
            "second_person_feminine_plural": "اِنْ{1}َ{3}ْنَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أَنْ{1}َا{3}ُ",
            "second_person_masculine_singular": "تَنْ{1}َا{3}ُ",
            "second_person_feminine_singular": "تَنْ{1}َا{3}ِينَ",
            "third_person_masculine_singular": "يَنْ{1}َا{3}ُ",
            "third_person_feminine_singular": "تَنْ{1}َا{3}ُ",
            "second_person_dual": "تَنْ{1}َا{3}َانِ",
            "third_person_masculine_dual": "يَنْ{1}َا{3}َانِ",
            "third_person_feminine_dual": "تَنْ{1}َا{3}َانِ",
            "first_person_plural": "نَنْ{1}َا{3}ُ",
            "second_person_masculine_plural": "تَنْ{1}َا{3}ُونَ",
            "second_person_feminine_plural": "تَنْ{1}َ{3}ْنَ",
            "third_person_masculine_plural": "يَنْ{1}َا{3}ُونَ",
            "third_person_feminine_plural": "يَنْ{1}َ{3}ْنَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أَنْ{1}َا{3}َ",
            "second_person_masculine_singular": "تَنْ{1}َا{3}َ",
            "second_person_feminine_singular": "تَنْ{1}َا{3}ِي",
            "third_person_masculine_singular": "يَنْ{1}َا{3}َ",
            "third_person_feminine_singular": "تَنْ{1}َا{3}َ",
            "second_person_dual": "تَنْ{1}َا{3}َا",
            "third_person_masculine_dual": "يَنْ{1}َا{3}َا",
            "third_person_feminine_dual": "تَنْ{1}َا{3}َا",
            "first_person_plural": "نَنْ{1}َا{3}َ",
            "second_person_masculine_plural": "تَنْ{1}َا{3}ُوا",
            "second_person_feminine_plural": "تَنْ{1}َ{3}ْنَ",
            "third_person_masculine_plural": "يَنْ{1}َا{3}ُوا",
            "third_person_feminine_plural": "يَنْ{1}َ{3}ْنَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أَنْ{1}َ{3}ْ",
            "second_person_masculine_singular": "تَنْ{1}َ{3}ْ",
            "second_person_feminine_singular": "تَنْ{1}َا{3}ِي",
            "third_person_masculine_singular": "يَنْ{1}َ{3}ْ",
            "third_person_feminine_singular": "تَنْ{1}َ{3}ْ",
            "second_person_dual": "تَنْ{1}َا{3}َا",
            "third_person_masculine_dual": "يَنْ{1}َا{3}َا",
            "third_person_feminine_dual": "تَنْ{1}َا{3}َا",
            "first_person_plural": "نَنْ{1}َ{3}ْ",
            "second_person_masculine_plural": "تَنْ{1}َا{3}ُوا",
            "second_person_feminine_plural": "تَنْ{1}َ{3}ْنَ",
            "third_person_masculine_plural": "يَنْ{1}َا{3}ُوا",
            "third_person_feminine_plural": "يَنْ{1}َ{3}ْنَ"
          }
        }'::jsonb,
        TRUE,
        FALSE,
        'sound',
        'waw',
        'sound',
        FALSE,
        NULL,
        NULL);

SELECT add_morph_pattern_resolution('f7-hollow', 'هيل');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f8-hollow',
        8,
        'اِفْتَعَلَ',
        'hollow',
        '{
          "masdar": "اِ{1}ْتِيَا{3}",
          "active_participle": "مُ{1}ْتَا{3}",
          "passive_participle": "مُ{1}ْتَا{3}",
          "perfect": {
            "first_person_singular": "اِ{1}ْتَ{3}ْتُ",
            "second_person_masculine_singular": "اِ{1}ْتَ{3}ْتَ",
            "second_person_feminine_singular": "اِ{1}ْتَ{3}ْتِ",
            "third_person_masculine_singular": "اِ{1}ْتَا{3}َ",
            "third_person_feminine_singular": "اِ{1}ْتَا{3}َتْ",
            "second_person_dual": "اِ{1}ْتَ{3}ْتُمَا",
            "third_person_masculine_dual": "اِ{1}ْتَا{3}َا",
            "third_person_feminine_dual": "اِ{1}ْتَا{3}َتَا",
            "first_person_plural": "اِ{1}ْتَ{3}ْنَا",
            "second_person_masculine_plural": "اِ{1}ْتَ{3}ْتُمْ",
            "second_person_feminine_plural": "اِ{1}ْتَ{3}ْتُنَّ",
            "third_person_masculine_plural": "اِ{1}ْتَا{3}ُوا",
            "third_person_feminine_plural": "اِ{1}ْتَ{3}ْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "اِ{1}ْتَ{3}ْ",
            "second_person_feminine_singular": "اِ{1}ْتَا{3}ِي",
            "second_person_dual": "اِ{1}ْتَا{3}َا",
            "second_person_masculine_plural": "اِ{1}ْتَا{3}ُوا",
            "second_person_feminine_plural": "اِ{1}ْتَ{3}ْنَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أَ{1}ْتَا{3}ُ",
            "second_person_masculine_singular": "تَ{1}ْتَا{3}ُ",
            "second_person_feminine_singular": "تَ{1}ْتَا{3}ِينَ",
            "third_person_masculine_singular": "يَ{1}ْتَا{3}ُ",
            "third_person_feminine_singular": "تَ{1}ْتَا{3}ُ",
            "second_person_dual": "تَ{1}ْتَا{3}َانِ",
            "third_person_masculine_dual": "يَ{1}ْتَا{3}َانِ",
            "third_person_feminine_dual": "تَ{1}ْتَا{3}َانِ",
            "first_person_plural": "نَ{1}ْتَا{3}ُ",
            "second_person_masculine_plural": "تَ{1}ْتَا{3}ُونَ",
            "second_person_feminine_plural": "تَ{1}ْتَ{3}ْنَ",
            "third_person_masculine_plural": "يَ{1}ْتَا{3}ُونَ",
            "third_person_feminine_plural": "يَ{1}ْتَ{3}ْنَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أَ{1}ْتَا{3}َ",
            "second_person_masculine_singular": "تَ{1}ْتَا{3}َ",
            "second_person_feminine_singular": "تَ{1}ْتَا{3}ِي",
            "third_person_masculine_singular": "يَ{1}ْتَا{3}َ",
            "third_person_feminine_singular": "تَ{1}ْتَا{3}َ",
            "second_person_dual": "تَ{1}ْتَا{3}َا",
            "third_person_masculine_dual": "يَ{1}ْتَا{3}َا",
            "third_person_feminine_dual": "تَ{1}ْتَا{3}َا",
            "first_person_plural": "نَ{1}ْتَا{3}َ",
            "second_person_masculine_plural": "تَ{1}ْتَا{3}ُوا",
            "second_person_feminine_plural": "تَ{1}ْتَ{3}ْنَ",
            "third_person_masculine_plural": "يَ{1}ْتَا{3}ُوا",
            "third_person_feminine_plural": "يَ{1}ْتَ{3}ْنَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أَ{1}ْتَ{3}ْ",
            "second_person_masculine_singular": "تَ{1}ْتَ{3}ْ",
            "second_person_feminine_singular": "تَ{1}ْتَا{3}ِي",
            "third_person_masculine_singular": "يَ{1}ْتَ{3}ْ",
            "third_person_feminine_singular": "تَ{1}ْتَ{3}ْ",
            "second_person_dual": "تَ{1}ْتَا{3}َا",
            "third_person_masculine_dual": "يَ{1}ْتَا{3}َا",
            "third_person_feminine_dual": "تَ{1}ْتَا{3}َا",
            "first_person_plural": "نَ{1}ْتَ{3}ْ",
            "second_person_masculine_plural": "تَ{1}ْتَا{3}ُوا",
            "second_person_feminine_plural": "تَ{1}ْتَ{3}ْنَ",
            "third_person_masculine_plural": "يَ{1}ْتَا{3}ُوا",
            "third_person_feminine_plural": "يَ{1}ْتَ{3}ْنَ"
          }
        }'::jsonb,
        TRUE,
        FALSE,
        'sound',
        'waw',
        'sound',
        FALSE,
        NULL,
        NULL);

SELECT add_morph_pattern_resolution('f8-hollow', 'خير');

SELECT add_morph_pattern_resolution('f10-hollow-waw', 'فيد');
