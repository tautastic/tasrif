INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f2-final-weak',
        2,
        'فَعَّلَ',
        'final-weak',
        '{
          "masdar": "تَ{1}ْ{2}ِيَة",
          "active_participle": "مُ{1}َ{2}ٍّ",
          "passive_participle": "مُ{1}َ{2}ًّى",
          "perfect": {
            "first_person_singular": "{1}َ{2}َّيْتُ",
            "second_person_masculine_singular": "{1}َ{2}َّيْتَ",
            "second_person_feminine_singular": "{1}َ{2}َّيْتِ",
            "third_person_masculine_singular": "{1}َ{2}َّى",
            "third_person_feminine_singular": "{1}َ{2}َّتْ",
            "second_person_dual": "{1}َ{2}َّيْتُمَا",
            "third_person_masculine_dual": "{1}َ{2}َّيَا",
            "third_person_feminine_dual": "{1}َ{2}َّتَا",
            "first_person_plural": "{1}َ{2}َّيْنَا",
            "second_person_masculine_plural": "{1}َ{2}َّيْتُمْ",
            "second_person_feminine_plural": "{1}َ{2}َّيْتُنَّ",
            "third_person_masculine_plural": "{1}َ{2}َّوْا",
            "third_person_feminine_plural": "{1}َ{2}َّيْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "{1}َ{2}ِّ",
            "second_person_feminine_singular": "{1}َ{2}ِّي",
            "second_person_dual": "{1}َ{2}ِّيَا",
            "second_person_masculine_plural": "{1}َ{2}ُّوا",
            "second_person_feminine_plural": "{1}َ{2}ِّينَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أُ{1}َ{2}ِّي",
            "second_person_masculine_singular": "تُ{1}َ{2}ِّي",
            "second_person_feminine_singular": "تُ{1}َ{2}ِّينَ",
            "third_person_masculine_singular": "يُ{1}َ{2}ِّي",
            "third_person_feminine_singular": "تُ{1}َ{2}ِّي",
            "second_person_dual": "تُ{1}َ{2}ِّيَانِ",
            "third_person_masculine_dual": "يُ{1}َ{2}ِّيَانِ",
            "third_person_feminine_dual": "تُ{1}َ{2}ِّيَانِ",
            "first_person_plural": "نُ{1}َ{2}ِّي",
            "second_person_masculine_plural": "تُ{1}َ{2}ُّونَ",
            "second_person_feminine_plural": "تُ{1}َ{2}ِّينَ",
            "third_person_masculine_plural": "يُ{1}َ{2}ُّونَ",
            "third_person_feminine_plural": "يُ{1}َ{2}ِّينَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أُ{1}َ{2}ِّيَ",
            "second_person_masculine_singular": "تُ{1}َ{2}ِّيَ",
            "second_person_feminine_singular": "تُ{1}َ{2}ِّي",
            "third_person_masculine_singular": "يُ{1}َ{2}ِّيَ",
            "third_person_feminine_singular": "تُ{1}َ{2}ِّيَ",
            "second_person_dual": "تُ{1}َ{2}ِّيَا",
            "third_person_masculine_dual": "يُ{1}َ{2}ِّيَا",
            "third_person_feminine_dual": "تُ{1}َ{2}ِّيَا",
            "first_person_plural": "نُ{1}َ{2}ِّيَ",
            "second_person_masculine_plural": "تُ{1}َ{2}ُّوا",
            "second_person_feminine_plural": "تُ{1}َ{2}ِّينَ",
            "third_person_masculine_plural": "يُ{1}َ{2}ُّوا",
            "third_person_feminine_plural": "يُ{1}َ{2}ِّينَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أُ{1}َ{2}ِّ",
            "second_person_masculine_singular": "تُ{1}َ{2}ِّ",
            "second_person_feminine_singular": "تُ{1}َ{2}ِّي",
            "third_person_masculine_singular": "يُ{1}َ{2}ِّ",
            "third_person_feminine_singular": "تُ{1}َ{2}ِّ",
            "second_person_dual": "تُ{1}َ{2}ِّيَا",
            "third_person_masculine_dual": "يُ{1}َ{2}ِّيَا",
            "third_person_feminine_dual": "تُ{1}َ{2}ِّيَا",
            "first_person_plural": "نُ{1}َ{2}ِّ",
            "second_person_masculine_plural": "تُ{1}َ{2}ُّوا",
            "second_person_feminine_plural": "تُ{1}َ{2}ِّينَ",
            "third_person_masculine_plural": "يُ{1}َ{2}ُّوا",
            "third_person_feminine_plural": "يُ{1}َ{2}ِّينَ"
          }
        }'::jsonb,
        TRUE,
        FALSE,
        'sound',
        'sound',
        'ya',
        FALSE,
        NULL,
        NULL);

SELECT add_morph_pattern_resolution('f2-final-weak', 'سمو');

SELECT add_morph_pattern_resolution('f2-final-weak', 'سوي');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f3-final-weak',
        3,
        'فَاعَلَ',
        'final-weak',
        '{
          "masdar": "مُ{1}َا{2}َاة",
          "active_participle": "مُ{1}َا{2}ٍ",
          "passive_participle": "مُ{1}َا{2}ًى",
          "perfect": {
            "first_person_singular": "{1}َا{2}َيْتُ",
            "second_person_masculine_singular": "{1}َا{2}َيْتَ",
            "second_person_feminine_singular": "{1}َا{2}َيْتِ",
            "third_person_masculine_singular": "{1}َا{2}َى",
            "third_person_feminine_singular": "{1}َا{2}َتْ",
            "second_person_dual": "{1}َا{2}َيْتُمَا",
            "third_person_masculine_dual": "{1}َا{2}َيَا",
            "third_person_feminine_dual": "{1}َا{2}َتَا",
            "first_person_plural": "{1}َا{2}َيْنَا",
            "second_person_masculine_plural": "{1}َا{2}َيْتُمْ",
            "second_person_feminine_plural": "{1}َا{2}َيْتُنَّ",
            "third_person_masculine_plural": "{1}َا{2}َوْا",
            "third_person_feminine_plural": "{1}َا{2}َيْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "{1}َا{2}ِ",
            "second_person_feminine_singular": "{1}َا{2}ِي",
            "second_person_dual": "{1}َا{2}ِيَا",
            "second_person_masculine_plural": "{1}َا{2}ُوا",
            "second_person_feminine_plural": "{1}َا{2}ِينَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أُ{1}َا{2}ِي",
            "second_person_masculine_singular": "تُ{1}َا{2}ِي",
            "second_person_feminine_singular": "تُ{1}َا{2}ِينَ",
            "third_person_masculine_singular": "يُ{1}َا{2}ِي",
            "third_person_feminine_singular": "تُ{1}َا{2}ِي",
            "second_person_dual": "تُ{1}َا{2}ِيَانِ",
            "third_person_masculine_dual": "يُ{1}َا{2}ِيَانِ",
            "third_person_feminine_dual": "تُ{1}َا{2}ِيَانِ",
            "first_person_plural": "نُ{1}َا{2}ِي",
            "second_person_masculine_plural": "تُ{1}َا{2}ُونَ",
            "second_person_feminine_plural": "تُ{1}َا{2}ِينَ",
            "third_person_masculine_plural": "يُ{1}َا{2}ُونَ",
            "third_person_feminine_plural": "يُ{1}َا{2}ِينَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أُ{1}َا{2}ِيَ",
            "second_person_masculine_singular": "تُ{1}َا{2}ِيَ",
            "second_person_feminine_singular": "تُ{1}َا{2}ِي",
            "third_person_masculine_singular": "يُ{1}َا{2}ِيَ",
            "third_person_feminine_singular": "تُ{1}َا{2}ِيَ",
            "second_person_dual": "تُ{1}َا{2}ِيَا",
            "third_person_masculine_dual": "يُ{1}َا{2}ِيَا",
            "third_person_feminine_dual": "تُ{1}َا{2}ِيَا",
            "first_person_plural": "نُ{1}َا{2}ِيَ",
            "second_person_masculine_plural": "تُ{1}َا{2}ُوا",
            "second_person_feminine_plural": "تُ{1}َا{2}ِينَ",
            "third_person_masculine_plural": "يُ{1}َا{2}ُوا",
            "third_person_feminine_plural": "يُ{1}َا{2}ِينَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أُ{1}َا{2}ِ",
            "second_person_masculine_singular": "تُ{1}َا{2}ِ",
            "second_person_feminine_singular": "تُ{1}َا{2}ِي",
            "third_person_masculine_singular": "يُ{1}َا{2}ِ",
            "third_person_feminine_singular": "تُ{1}َا{2}ِ",
            "second_person_dual": "تُ{1}َا{2}ِيَا",
            "third_person_masculine_dual": "يُ{1}َا{2}ِيَا",
            "third_person_feminine_dual": "تُ{1}َا{2}ِيَا",
            "first_person_plural": "نُ{1}َا{2}ِ",
            "second_person_masculine_plural": "تُ{1}َا{2}ُوا",
            "second_person_feminine_plural": "تُ{1}َا{2}ِينَ",
            "third_person_masculine_plural": "يُ{1}َا{2}ُوا",
            "third_person_feminine_plural": "يُ{1}َا{2}ِينَ"
          }
        }'::jsonb,
        TRUE,
        FALSE,
        'sound',
        'sound',
        'ya',
        FALSE,
        NULL,
        NULL);

SELECT add_morph_pattern_resolution('f3-final-weak', 'ندو');

SELECT add_morph_pattern_resolution('f3-final-weak', 'دوي');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f5-final-weak',
        5,
        'تَفَعَّلَ',
        'final-weak',
        '{
          "masdar": "تَ{1}َ{2}ٍّ",
          "active_participle": "مُتَ{1}َ{2}ٍّ",
          "passive_participle": "مُتَ{1}َ{2}ًّى",
          "perfect": {
            "first_person_singular": "تَ{1}َ{2}َّيْتُ",
            "second_person_masculine_singular": "تَ{1}َ{2}َّيْتَ",
            "second_person_feminine_singular": "تَ{1}َ{2}َّيْتِ",
            "third_person_masculine_singular": "تَ{1}َ{2}َّى",
            "third_person_feminine_singular": "تَ{1}َ{2}َّتْ",
            "second_person_dual": "تَ{1}َ{2}َّيْتُمَا",
            "third_person_masculine_dual": "تَ{1}َ{2}َّيَا",
            "third_person_feminine_dual": "تَ{1}َ{2}َّتَا",
            "first_person_plural": "تَ{1}َ{2}َّيْنَا",
            "second_person_masculine_plural": "تَ{1}َ{2}َّيْتُمْ",
            "second_person_feminine_plural": "تَ{1}َ{2}َّيْتُنَّ",
            "third_person_masculine_plural": "تَ{1}َ{2}َّوْا",
            "third_person_feminine_plural": "تَ{1}َ{2}َّيْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "تَ{1}َ{2}َّ",
            "second_person_feminine_singular": "تَ{1}َ{2}َّيْ",
            "second_person_dual": "تَ{1}َ{2}َّيَا",
            "second_person_masculine_plural": "تَ{1}َ{2}َّوْا",
            "second_person_feminine_plural": "تَ{1}َ{2}َّيْنَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أَتَ{1}َ{2}َّى",
            "second_person_masculine_singular": "تَتَ{1}َ{2}َّى",
            "second_person_feminine_singular": "تَتَ{1}َ{2}َّيْنَ",
            "third_person_masculine_singular": "يَتَ{1}َ{2}َّى",
            "third_person_feminine_singular": "تَتَ{1}َ{2}َّى",
            "second_person_dual": "تَتَ{1}َ{2}َّيَانِ",
            "third_person_masculine_dual": "يَتَ{1}َ{2}َّيَانِ",
            "third_person_feminine_dual": "تَتَ{1}َ{2}َّيَانِ",
            "first_person_plural": "نَتَ{1}َ{2}َّى",
            "second_person_masculine_plural": "تَتَ{1}َ{2}َّوْنَ",
            "second_person_feminine_plural": "تَتَ{1}َ{2}َّيْنَ",
            "third_person_masculine_plural": "يَتَ{1}َ{2}َّوْنَ",
            "third_person_feminine_plural": "يَتَ{1}َ{2}َّيْنَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أَتَ{1}َ{2}َّى",
            "second_person_masculine_singular": "تَتَ{1}َ{2}َّى",
            "second_person_feminine_singular": "تَتَ{1}َ{2}َّيْ",
            "third_person_masculine_singular": "يَتَ{1}َ{2}َّى",
            "third_person_feminine_singular": "تَتَ{1}َ{2}َّى",
            "second_person_dual": "تَتَ{1}َ{2}َّيَا",
            "third_person_masculine_dual": "يَتَ{1}َ{2}َّيَا",
            "third_person_feminine_dual": "تَتَ{1}َ{2}َّيَا",
            "first_person_plural": "نَتَ{1}َ{2}َّى",
            "second_person_masculine_plural": "تَتَ{1}َ{2}َّوْا",
            "second_person_feminine_plural": "تَتَ{1}َ{2}َّيْنَ",
            "third_person_masculine_plural": "يَتَ{1}َ{2}َّوْا",
            "third_person_feminine_plural": "يَتَ{1}َ{2}َّيْنَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أَتَ{1}َ{2}َّ",
            "second_person_masculine_singular": "تَتَ{1}َ{2}َّ",
            "second_person_feminine_singular": "تَتَ{1}َ{2}َّيْ",
            "third_person_masculine_singular": "يَتَ{1}َ{2}َّ",
            "third_person_feminine_singular": "تَتَ{1}َ{2}َّ",
            "second_person_dual": "تَتَ{1}َ{2}َّيَا",
            "third_person_masculine_dual": "يَتَ{1}َ{2}َّيَا",
            "third_person_feminine_dual": "تَتَ{1}َ{2}َّيَا",
            "first_person_plural": "نَتَ{1}َ{2}َّ",
            "second_person_masculine_plural": "تَتَ{1}َ{2}َّوْا",
            "second_person_feminine_plural": "تَتَ{1}َ{2}َّيْنَ",
            "third_person_masculine_plural": "يَتَ{1}َ{2}َّوْا",
            "third_person_feminine_plural": "يَتَ{1}َ{2}َّيْنَ"
          }
        }'::jsonb,
        TRUE,
        FALSE,
        'sound',
        'sound',
        'ya',
        FALSE,
        NULL,
        NULL);

SELECT add_morph_pattern_resolution('f5-final-weak', 'حدو');

SELECT add_morph_pattern_resolution('f5-final-weak', 'وفي');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f6-final-weak',
        6,
        'تَفَاعَلَ',
        'final-weak',
        '{
          "masdar": "تَ{1}َا{2}ٍ",
          "active_participle": "مُتَ{1}َا{2}ٍ",
          "passive_participle": "مُتَ{1}َا{2}ًى",
          "perfect": {
            "first_person_singular": "تَ{1}َا{2}َيْتُ",
            "second_person_masculine_singular": "تَ{1}َا{2}َيْتَ",
            "second_person_feminine_singular": "تَ{1}َا{2}َيْتِ",
            "third_person_masculine_singular": "تَ{1}َا{2}َى",
            "third_person_feminine_singular": "تَ{1}َا{2}َتْ",
            "second_person_dual": "تَ{1}َا{2}َيْتُمَا",
            "third_person_masculine_dual": "تَ{1}َا{2}َيَا",
            "third_person_feminine_dual": "تَ{1}َا{2}َتَا",
            "first_person_plural": "تَ{1}َا{2}َيْنَا",
            "second_person_masculine_plural": "تَ{1}َا{2}َيْتُمْ",
            "second_person_feminine_plural": "تَ{1}َا{2}َيْتُنَّ",
            "third_person_masculine_plural": "تَ{1}َا{2}َوْا",
            "third_person_feminine_plural": "تَ{1}َا{2}َيْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "تَ{1}َا{2}َ",
            "second_person_feminine_singular": "تَ{1}َا{2}َيْ",
            "second_person_dual": "تَ{1}َا{2}َيَا",
            "second_person_masculine_plural": "تَ{1}َا{2}َوْا",
            "second_person_feminine_plural": "تَ{1}َا{2}َيْنَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أَتَ{1}َا{2}َى",
            "second_person_masculine_singular": "تَتَ{1}َا{2}َى",
            "second_person_feminine_singular": "تَتَ{1}َا{2}َيْنَ",
            "third_person_masculine_singular": "يَتَ{1}َا{2}َى",
            "third_person_feminine_singular": "تَتَ{1}َا{2}َى",
            "second_person_dual": "تَتَ{1}َا{2}َيَانِ",
            "third_person_masculine_dual": "يَتَ{1}َا{2}َيَانِ",
            "third_person_feminine_dual": "تَتَ{1}َا{2}َيَانِ",
            "first_person_plural": "نَتَ{1}َا{2}َى",
            "second_person_masculine_plural": "تَتَ{1}َا{2}َوْنَ",
            "second_person_feminine_plural": "تَتَ{1}َا{2}َيْنَ",
            "third_person_masculine_plural": "يَتَ{1}َا{2}َوْنَ",
            "third_person_feminine_plural": "يَتَ{1}َا{2}َيْنَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أَتَ{1}َا{2}َى",
            "second_person_masculine_singular": "تَتَ{1}َا{2}َى",
            "second_person_feminine_singular": "تَتَ{1}َا{2}َيْ",
            "third_person_masculine_singular": "يَتَ{1}َا{2}َى",
            "third_person_feminine_singular": "تَتَ{1}َا{2}َى",
            "second_person_dual": "تَتَ{1}َا{2}َيَا",
            "third_person_masculine_dual": "يَتَ{1}َا{2}َيَا",
            "third_person_feminine_dual": "تَتَ{1}َا{2}َيَا",
            "first_person_plural": "نَتَ{1}َا{2}َى",
            "second_person_masculine_plural": "تَتَ{1}َا{2}َوْا",
            "second_person_feminine_plural": "تَتَ{1}َا{2}َيْنَ",
            "third_person_masculine_plural": "يَتَ{1}َا{2}َوْا",
            "third_person_feminine_plural": "يَتَ{1}َا{2}َيْنَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أَتَ{1}َا{2}َ",
            "second_person_masculine_singular": "تَتَ{1}َا{2}َ",
            "second_person_feminine_singular": "تَتَ{1}َا{2}َيْ",
            "third_person_masculine_singular": "يَتَ{1}َا{2}َ",
            "third_person_feminine_singular": "تَتَ{1}َا{2}َ",
            "second_person_dual": "تَتَ{1}َا{2}َيَا",
            "third_person_masculine_dual": "يَتَ{1}َا{2}َيَا",
            "third_person_feminine_dual": "تَتَ{1}َا{2}َيَا",
            "first_person_plural": "نَتَ{1}َا{2}َ",
            "second_person_masculine_plural": "تَتَ{1}َا{2}َوْا",
            "second_person_feminine_plural": "تَتَ{1}َا{2}َيْنَ",
            "third_person_masculine_plural": "يَتَ{1}َا{2}َوْا",
            "third_person_feminine_plural": "يَتَ{1}َا{2}َيْنَ"
          }
        }'::jsonb,
        TRUE,
        FALSE,
        'sound',
        'sound',
        'ya',
        FALSE,
        NULL,
        NULL);

SELECT add_morph_pattern_resolution('f6-final-weak', 'علو');

SELECT add_morph_pattern_resolution('f6-final-weak', 'ولي');

SELECT add_morph_pattern_resolution('f6-final-weak', 'سوي');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f7-final-weak',
        7,
        'اِنْفَعَلَ',
        'final-weak',
        '{
          "masdar": "اِنْ{1}ِ{2}َاء",
          "active_participle": "مُنْ{1}َ{2}ٍ",
          "passive_participle": "مُنْ{1}َ{2}ًى",
          "perfect": {
            "first_person_singular": "اِنْ{1}َ{2}َيْتُ",
            "second_person_masculine_singular": "اِنْ{1}َ{2}َيْتَ",
            "second_person_feminine_singular": "اِنْ{1}َ{2}َيْتِ",
            "third_person_masculine_singular": "اِنْ{1}َ{2}َى",
            "third_person_feminine_singular": "اِنْ{1}َ{2}َتْ",
            "second_person_dual": "اِنْ{1}َ{2}َيْتُمَا",
            "third_person_masculine_dual": "اِنْ{1}َ{2}َيَا",
            "third_person_feminine_dual": "اِنْ{1}َ{2}َتَا",
            "first_person_plural": "اِنْ{1}َ{2}َيْنَا",
            "second_person_masculine_plural": "اِنْ{1}َ{2}َيْتُمْ",
            "second_person_feminine_plural": "اِنْ{1}َ{2}َيْتُنَّ",
            "third_person_masculine_plural": "اِنْ{1}َ{2}َوْا",
            "third_person_feminine_plural": "اِنْ{1}َ{2}َيْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "اِنْ{1}َ{2}ِ",
            "second_person_feminine_singular": "اِنْ{1}َ{2}ِي",
            "second_person_dual": "اِنْ{1}َ{2}ِيَا",
            "second_person_masculine_plural": "اِنْ{1}َ{2}ُوا",
            "second_person_feminine_plural": "اِنْ{1}َ{2}ِينَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أَنْ{1}َ{2}ِي",
            "second_person_masculine_singular": "تَنْ{1}َ{2}ِي",
            "second_person_feminine_singular": "تَنْ{1}َ{2}ِينَ",
            "third_person_masculine_singular": "يَنْ{1}َ{2}ِي",
            "third_person_feminine_singular": "تَنْ{1}َ{2}ِي",
            "second_person_dual": "تَنْ{1}َ{2}ِيَانِ",
            "third_person_masculine_dual": "يَنْ{1}َ{2}ِيَانِ",
            "third_person_feminine_dual": "تَنْ{1}َ{2}ِيَانِ",
            "first_person_plural": "نَنْ{1}َ{2}ِي",
            "second_person_masculine_plural": "تَنْ{1}َ{2}ُونَ",
            "second_person_feminine_plural": "تَنْ{1}َ{2}ِينَ",
            "third_person_masculine_plural": "يَنْ{1}َ{2}ُونَ",
            "third_person_feminine_plural": "يَنْ{1}َ{2}ِينَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أَنْ{1}َ{2}ِيَ",
            "second_person_masculine_singular": "تَنْ{1}َ{2}ِيَ",
            "second_person_feminine_singular": "تَنْ{1}َ{2}ِي",
            "third_person_masculine_singular": "يَنْ{1}َ{2}ِيَ",
            "third_person_feminine_singular": "تَنْ{1}َ{2}ِيَ",
            "second_person_dual": "تَنْ{1}َ{2}ِيَا",
            "third_person_masculine_dual": "يَنْ{1}َ{2}ِيَا",
            "third_person_feminine_dual": "تَنْ{1}َ{2}ِيَا",
            "first_person_plural": "نَنْ{1}َ{2}ِيَ",
            "second_person_masculine_plural": "تَنْ{1}َ{2}ُوا",
            "second_person_feminine_plural": "تَنْ{1}َ{2}ِينَ",
            "third_person_masculine_plural": "يَنْ{1}َ{2}ُوا",
            "third_person_feminine_plural": "يَنْ{1}َ{2}ِينَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أَنْ{1}َ{2}ِ",
            "second_person_masculine_singular": "تَنْ{1}َ{2}ِ",
            "second_person_feminine_singular": "تَنْ{1}َ{2}ِي",
            "third_person_masculine_singular": "يَنْ{1}َ{2}ِ",
            "third_person_feminine_singular": "تَنْ{1}َ{2}ِ",
            "second_person_dual": "تَنْ{1}َ{2}ِيَا",
            "third_person_masculine_dual": "يَنْ{1}َ{2}ِيَا",
            "third_person_feminine_dual": "تَنْ{1}َ{2}ِيَا",
            "first_person_plural": "نَنْ{1}َ{2}ِ",
            "second_person_masculine_plural": "تَنْ{1}َ{2}ُوا",
            "second_person_feminine_plural": "تَنْ{1}َ{2}ِينَ",
            "third_person_masculine_plural": "يَنْ{1}َ{2}ُوا",
            "third_person_feminine_plural": "يَنْ{1}َ{2}ِينَ"
          }
        }'::jsonb,
        TRUE,
        FALSE,
        'sound',
        'sound',
        'ya',
        FALSE,
        NULL,
        NULL);

SELECT add_morph_pattern_resolution('f7-final-weak', 'محو');

SELECT add_morph_pattern_resolution('f7-final-weak', 'طوي');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f8-assimilated-waw-final-weak',
        8,
        'اِفْتَعَلَ',
        'assimilated waw, final-weak',
        '{
          "masdar": "اِتِّ{2}َاء",
          "active_participle": "مُتَّ{2}ٍ",
          "passive_participle": "مُتَّ{2}ًى",
          "perfect": {
            "first_person_singular": "اِتَّ{2}َيْتُ",
            "second_person_masculine_singular": "اِتَّ{2}َيْتَ",
            "second_person_feminine_singular": "اِتَّ{2}َيْتِ",
            "third_person_masculine_singular": "اِتَّ{2}َى",
            "third_person_feminine_singular": "اِتَّ{2}َتْ",
            "second_person_dual": "اِتَّ{2}َيْتُمَا",
            "third_person_masculine_dual": "اِتَّ{2}َيَا",
            "third_person_feminine_dual": "اِتَّ{2}َتَا",
            "first_person_plural": "اِتَّ{2}َيْنَا",
            "second_person_masculine_plural": "اِتَّ{2}َيْتُمْ",
            "second_person_feminine_plural": "اِتَّ{2}َيْتُنَّ",
            "third_person_masculine_plural": "اِتَّ{2}َوْا",
            "third_person_feminine_plural": "اِتَّ{2}َيْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "اِتَّ{2}ِ",
            "second_person_feminine_singular": "اِتَّ{2}ِي",
            "second_person_dual": "اِتَّ{2}ِيَا",
            "second_person_masculine_plural": "اِتَّ{2}ُوا",
            "second_person_feminine_plural": "اِتَّ{2}ِينَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أَتَّ{2}ِي",
            "second_person_masculine_singular": "تَتَّ{2}ِي",
            "second_person_feminine_singular": "تَتَّ{2}ِينَ",
            "third_person_masculine_singular": "يَتَّ{2}ِي",
            "third_person_feminine_singular": "تَتَّ{2}ِي",
            "second_person_dual": "تَتَّ{2}ِيَانِ",
            "third_person_masculine_dual": "يَتَّ{2}ِيَانِ",
            "third_person_feminine_dual": "تَتَّ{2}ِيَانِ",
            "first_person_plural": "نَتَّ{2}ِي",
            "second_person_masculine_plural": "تَتَّ{2}ُونَ",
            "second_person_feminine_plural": "تَتَّ{2}ِينَ",
            "third_person_masculine_plural": "يَتَّ{2}ُونَ",
            "third_person_feminine_plural": "يَتَّ{2}ِينَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أَتَّ{2}ِيَ",
            "second_person_masculine_singular": "تَتَّ{2}ِيَ",
            "second_person_feminine_singular": "تَتَّ{2}ِي",
            "third_person_masculine_singular": "يَتَّ{2}ِيَ",
            "third_person_feminine_singular": "تَتَّ{2}ِيَ",
            "second_person_dual": "تَتَّ{2}ِيَا",
            "third_person_masculine_dual": "يَتَّ{2}ِيَا",
            "third_person_feminine_dual": "تَتَّ{2}ِيَا",
            "first_person_plural": "نَتَّ{2}ِيَ",
            "second_person_masculine_plural": "تَتَّ{2}ُوا",
            "second_person_feminine_plural": "تَتَّ{2}ِينَ",
            "third_person_masculine_plural": "يَتَّ{2}ُوا",
            "third_person_feminine_plural": "يَتَّ{2}ِينَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أَتَّ{2}ِ",
            "second_person_masculine_singular": "تَتَّ{2}ِ",
            "second_person_feminine_singular": "تَتَّ{2}ِي",
            "third_person_masculine_singular": "يَتَّ{2}ِ",
            "third_person_feminine_singular": "تَتَّ{2}ِ",
            "second_person_dual": "تَتَّ{2}ِيَا",
            "third_person_masculine_dual": "يَتَّ{2}ِيَا",
            "third_person_feminine_dual": "تَتَّ{2}ِيَا",
            "first_person_plural": "نَتَّ{2}ِ",
            "second_person_masculine_plural": "تَتَّ{2}ُوا",
            "second_person_feminine_plural": "تَتَّ{2}ِينَ",
            "third_person_masculine_plural": "يَتَّ{2}ُوا",
            "third_person_feminine_plural": "يَتَّ{2}ِينَ"
          }
        }'::jsonb,
        TRUE,
        FALSE,
        'waw',
        'sound',
        'ya',
        FALSE,
        NULL,
        NULL);

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f10-assimilated-waw-final-weak',
        10,
        'اِسْتَفْعَلَ',
        'assimilated waw, final-weak',
        '{
          "masdar": "اِسْتِي{2}َاء",
          "active_participle": "مُسْتَ{1}ْ{2}ٍ",
          "passive_participle": "مُسْتَ{1}ْ{2}ًى",
          "perfect": {
            "first_person_singular": "اِسْتَ{1}ْ{2}َيْتُ",
            "second_person_masculine_singular": "اِسْتَ{1}ْ{2}َيْتَ",
            "second_person_feminine_singular": "اِسْتَ{1}ْ{2}َيْتِ",
            "third_person_masculine_singular": "اِسْتَ{1}ْ{2}َى",
            "third_person_feminine_singular": "اِسْتَ{1}ْ{2}َتْ",
            "second_person_dual": "اِسْتَ{1}ْ{2}َيْتُمَا",
            "third_person_masculine_dual": "اِسْتَ{1}ْ{2}َيَا",
            "third_person_feminine_dual": "اِسْتَ{1}ْ{2}َتَا",
            "first_person_plural": "اِسْتَ{1}ْ{2}َيْنَا",
            "second_person_masculine_plural": "اِسْتَ{1}ْ{2}َيْتُمْ",
            "second_person_feminine_plural": "اِسْتَ{1}ْ{2}َيْتُنَّ",
            "third_person_masculine_plural": "اِسْتَ{1}ْ{2}َوْا",
            "third_person_feminine_plural": "اِسْتَ{1}ْ{2}َيْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "اِسْتَ{1}ْ{2}ِ",
            "second_person_feminine_singular": "اِسْتَ{1}ْ{2}ِي",
            "second_person_dual": "اِسْتَ{1}ْ{2}ِيَا",
            "second_person_masculine_plural": "اِسْتَ{1}ْ{2}ُوا",
            "second_person_feminine_plural": "اِسْتَ{1}ْ{2}ِينَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أَسْتَ{1}ْ{2}ِي",
            "second_person_masculine_singular": "تَسْتَ{1}ْ{2}ِي",
            "second_person_feminine_singular": "تَسْتَ{1}ْ{2}ِينَ",
            "third_person_masculine_singular": "يَسْتَ{1}ْ{2}ِي",
            "third_person_feminine_singular": "تَسْتَ{1}ْ{2}ِي",
            "second_person_dual": "تَسْتَ{1}ْ{2}ِيَانِ",
            "third_person_masculine_dual": "يَسْتَ{1}ْ{2}ِيَانِ",
            "third_person_feminine_dual": "تَسْتَ{1}ْ{2}ِيَانِ",
            "first_person_plural": "نَسْتَ{1}ْ{2}ِي",
            "second_person_masculine_plural": "تَسْتَ{1}ْ{2}ُونَ",
            "second_person_feminine_plural": "تَسْتَ{1}ْ{2}ِينَ",
            "third_person_masculine_plural": "يَسْتَ{1}ْ{2}ُونَ",
            "third_person_feminine_plural": "يَسْتَ{1}ْ{2}ِينَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أَسْتَ{1}ْ{2}ِيَ",
            "second_person_masculine_singular": "تَسْتَ{1}ْ{2}ِيَ",
            "second_person_feminine_singular": "تَسْتَ{1}ْ{2}ِي",
            "third_person_masculine_singular": "يَسْتَ{1}ْ{2}ِيَ",
            "third_person_feminine_singular": "تَسْتَ{1}ْ{2}ِيَ",
            "second_person_dual": "تَسْتَ{1}ْ{2}ِيَا",
            "third_person_masculine_dual": "يَسْتَ{1}ْ{2}ِيَا",
            "third_person_feminine_dual": "تَسْتَ{1}ْ{2}ِيَا",
            "first_person_plural": "نَسْتَ{1}ْ{2}ِيَ",
            "second_person_masculine_plural": "تَسْتَ{1}ْ{2}ُوا",
            "second_person_feminine_plural": "تَسْتَ{1}ْ{2}ِينَ",
            "third_person_masculine_plural": "يَسْتَ{1}ْ{2}ُوا",
            "third_person_feminine_plural": "يَسْتَ{1}ْ{2}ِينَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أَسْتَ{1}ْ{2}ِ",
            "second_person_masculine_singular": "تَسْتَ{1}ْ{2}ِ",
            "second_person_feminine_singular": "تَسْتَ{1}ْ{2}ِي",
            "third_person_masculine_singular": "يَسْتَ{1}ْ{2}ِ",
            "third_person_feminine_singular": "تَسْتَ{1}ْ{2}ِ",
            "second_person_dual": "تَسْتَ{1}ْ{2}ِيَا",
            "third_person_masculine_dual": "يَسْتَ{1}ْ{2}ِيَا",
            "third_person_feminine_dual": "تَسْتَ{1}ْ{2}ِيَا",
            "first_person_plural": "نَسْتَ{1}ْ{2}ِ",
            "second_person_masculine_plural": "تَسْتَ{1}ْ{2}ُوا",
            "second_person_feminine_plural": "تَسْتَ{1}ْ{2}ِينَ",
            "third_person_masculine_plural": "يَسْتَ{1}ْ{2}ُوا",
            "third_person_feminine_plural": "يَسْتَ{1}ْ{2}ِينَ"
          }
        }'::jsonb,
        TRUE,
        FALSE,
        'waw',
        'sound',
        'ya',
        FALSE,
        NULL,
        NULL);

SELECT add_morph_pattern_resolution('f8-final-weak-ya', 'سوي');
