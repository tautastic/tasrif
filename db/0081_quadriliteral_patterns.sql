INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f1-a-i-quadriliteral',
        1,
        4,
        'فَعْلَلَ',
        'quadriliteral',
        '{
          "masdar": "{1}َ{2}ْ{3}َ{4}َة",
          "perfect": "{1}َ{2}ْ{3}َ{4}",
          "imperative": "{1}َ{2}ْ{3}ِ{4}",
          "imperfect_stem": "{1}َ{2}ْ{3}ِ{4}",
          "active_participle": "مُ{1}َ{2}ْ{3}ِ{4}",
          "passive_participle": "مُ{1}َ{2}ْ{3}َ{4}"
        }'::jsonb,
        FALSE, FALSE,
        'sound', 'sound', 'sound', FALSE,
        'a', 'i');

INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f2-quadriliteral',
        2,
        4,
        'تَفَعْلَلَ',
        'quadriliteral',
        '{
          "masdar": "تَ{1}َ{2}ْ{3}ُ{4}",
          "perfect": "تَ{1}َ{2}ْ{3}َ{4}",
          "imperative": "تَ{1}َ{2}ْ{3}َ{4}",
          "imperfect_stem": "تَ{1}َ{2}ْ{3}َ{4}",
          "active_participle": "مُتَ{1}َ{2}ْ{3}ِ{4}",
          "passive_participle": "مُتَ{1}َ{2}ْ{3}َ{4}"
        }'::jsonb,
        FALSE, FALSE,
        'sound', 'sound', 'sound', FALSE,
        NULL, NULL);

INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f3-quadriliteral',
        3,
        4,
        'اِفْعَنْلَلَ',
        'quadriliteral',
        '{
          "masdar": "اِ{1}ْ{2}ِنْ{3}َا{4}",
          "perfect": "اِ{1}ْ{2}َنْ{3}َ{4}",
          "imperative": "اِ{1}ْ{2}َنْ{3}ِ{4}",
          "imperfect_stem": "{1}ْ{2}َنْ{3}ِ{4}",
          "active_participle": "مُ{1}ْ{2}َنْ{3}ِ{4}",
          "passive_participle": "مُ{1}ْ{2}َنْ{3}َ{4}"
        }'::jsonb,
        FALSE, FALSE,
        'sound', 'sound', 'sound', FALSE,
        NULL, NULL);

INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f4-quadriliteral',
        4,
        4,
        'اِفْعَلَلَّ',
        'quadriliteral',
        '{
          "masdar": "اِ{1}ْ{2}ِ{3}ْ{4}َا{4}",
          "active_participle": "مُ{1}ْ{2}َ{3}ِ{4}ّ",
          "passive_participle": "مُ{1}ْ{2}َ{3}َ{4}ّ",
          "perfect": {
            "first_person_singular": "اِ{1}ْ{2}َ{3}ْ{4}َ{4}ْتُ",
            "second_person_masculine_singular": "اِ{1}ْ{2}َ{3}ْ{4}َ{4}ْتَ",
            "second_person_feminine_singular": "اِ{1}ْ{2}َ{3}ْ{4}َ{4}ْتِ",
            "third_person_masculine_singular": "اِ{1}ْ{2}َ{3}َ{4}َّ",
            "third_person_feminine_singular": "اِ{1}ْ{2}َ{3}َ{4}َّتْ",
            "second_person_dual": "اِ{1}ْ{2}َ{3}ْ{4}َ{4}ْتُمَا",
            "third_person_masculine_dual": "اِ{1}ْ{2}َ{3}َ{4}َّا",
            "third_person_feminine_dual": "اِ{1}ْ{2}َ{3}َ{4}َّتَا",
            "first_person_plural": "اِ{1}ْ{2}َ{3}ْ{4}َ{4}ْنَا",
            "second_person_masculine_plural": "اِ{1}ْ{2}َ{3}ْ{4}َ{4}ْتُمْ",
            "second_person_feminine_plural": "اِ{1}ْ{2}َ{3}ْ{4}َ{4}ْتُنَّ",
            "third_person_masculine_plural": "اِ{1}ْ{2}َ{3}َ{4}ُّوا",
            "third_person_feminine_plural": "اِ{1}ْ{2}َ{3}ْ{4}َ{4}ْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "اِ{1}ْ{2}َ{3}ِ{4}َّ",
            "second_person_feminine_singular": "اِ{1}ْ{2}َ{3}ِ{4}ِّي",
            "second_person_dual": "اِ{1}ْ{2}َ{3}ِ{4}َّا",
            "second_person_masculine_plural": "اِ{1}ْ{2}َ{3}ِ{4}ُّوا",
            "second_person_feminine_plural": "اِ{1}ْ{2}َ{3}ْ{4}ِ{4}ْنَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أَ{1}ْ{2}َ{3}ِ{4}ُّ",
            "second_person_masculine_singular": "تَ{1}ْ{2}َ{3}ِ{4}ُّ",
            "second_person_feminine_singular": "تَ{1}ْ{2}َ{3}ِ{4}ِّينَ",
            "third_person_masculine_singular": "يَ{1}ْ{2}َ{3}ِ{4}ُّ",
            "third_person_feminine_singular": "تَ{1}ْ{2}َ{3}ِ{4}ُّ",
            "second_person_dual": "تَ{1}ْ{2}َ{3}ِ{4}َّانِ",
            "third_person_masculine_dual": "يَ{1}ْ{2}َ{3}ِ{4}َّانِ",
            "third_person_feminine_dual": "تَ{1}ْ{2}َ{3}ِ{4}َّانِ",
            "first_person_plural": "نَ{1}ْ{2}َ{3}ِ{4}ُّ",
            "second_person_masculine_plural": "تَ{1}ْ{2}َ{3}ِ{4}ُّونَ",
            "second_person_feminine_plural": "تَ{1}ْ{2}َ{3}ْ{4}ِ{4}ْنَ",
            "third_person_masculine_plural": "يَ{1}ْ{2}َ{3}ِ{4}ُّونَ",
            "third_person_feminine_plural": "يَ{1}ْ{2}َ{3}ْ{4}ِ{4}ْنَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أَ{1}ْ{2}َ{3}ِ{4}َّ",
            "second_person_masculine_singular": "تَ{1}ْ{2}َ{3}ِ{4}َّ",
            "second_person_feminine_singular": "تَ{1}ْ{2}َ{3}ِ{4}ِّي",
            "third_person_masculine_singular": "يَ{1}ْ{2}َ{3}ِ{4}َّ",
            "third_person_feminine_singular": "تَ{1}ْ{2}َ{3}ِ{4}َّ",
            "second_person_dual": "تَ{1}ْ{2}َ{3}ِ{4}َّا",
            "third_person_masculine_dual": "يَ{1}ْ{2}َ{3}ِ{4}َّا",
            "third_person_feminine_dual": "تَ{1}ْ{2}َ{3}ِ{4}َّا",
            "first_person_plural": "نَ{1}ْ{2}َ{3}ِ{4}َّ",
            "second_person_masculine_plural": "تَ{1}ْ{2}َ{3}ِ{4}ُّوا",
            "second_person_feminine_plural": "تَ{1}ْ{2}َ{3}ْ{4}ِ{4}ْنَ",
            "third_person_masculine_plural": "يَ{1}ْ{2}َ{3}ِ{4}ُّوا",
            "third_person_feminine_plural": "يَ{1}ْ{2}َ{3}ْ{4}ِ{4}ْنَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أَ{1}ْ{2}َ{3}ِ{4}َّ",
            "second_person_masculine_singular": "تَ{1}ْ{2}َ{3}ِ{4}َّ",
            "second_person_feminine_singular": "تَ{1}ْ{2}َ{3}ِ{4}ِّي",
            "third_person_masculine_singular": "يَ{1}ْ{2}َ{3}ِ{4}َّ",
            "third_person_feminine_singular": "تَ{1}ْ{2}َ{3}ِ{4}َّ",
            "second_person_dual": "تَ{1}ْ{2}َ{3}ِ{4}َّا",
            "third_person_masculine_dual": "يَ{1}ْ{2}َ{3}ِ{4}َّا",
            "third_person_feminine_dual": "تَ{1}ْ{2}َ{3}ِ{4}َّا",
            "first_person_plural": "نَ{1}ْ{2}َ{3}ِ{4}َّ",
            "second_person_masculine_plural": "تَ{1}ْ{2}َ{3}ِ{4}ُّوا",
            "second_person_feminine_plural": "تَ{1}ْ{2}َ{3}ْ{4}ِ{4}ْنَ",
            "third_person_masculine_plural": "يَ{1}ْ{2}َ{3}ِ{4}ُّوا",
            "third_person_feminine_plural": "يَ{1}ْ{2}َ{3}ْ{4}ِ{4}ْنَ"
          }
        }'::jsonb,
        TRUE, FALSE,
        'sound', 'sound', 'sound', FALSE,
        NULL, NULL);


INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('دحرج', 1, 'a', 'i', morph_pattern_id_for_code('f1-a-i-quadriliteral'), 'sample root of the quadriliteral form I pattern, which shape resolution reaches for every sound quadriliteral root'),
       ('دحرج', 2, NULL, NULL, morph_pattern_id_for_code('f2-quadriliteral'), 'sample root of the quadriliteral form II pattern, which shape resolution reaches for every sound quadriliteral root'),
       ('حرجم', 3, NULL, NULL, morph_pattern_id_for_code('f3-quadriliteral'), 'sample root of the quadriliteral form III pattern, which shape resolution reaches for every sound quadriliteral root'),
       ('قشعر', 4, NULL, NULL, morph_pattern_id_for_code('f4-quadriliteral'), 'sample root of the quadriliteral form IV pattern, which shape resolution reaches for every sound quadriliteral root');
