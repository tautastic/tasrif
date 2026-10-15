INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f1-i-a-hollow-ya-final-weak',
        1,
        'فَعِلَ',
        'i ~ a, hollow ya, final-weak',
        '{
          "masdar": "{1}َ{2}َاة",
          "perfect": {
            "first_person_singular": "{1}َ{2}ِيتُ",
            "second_person_masculine_singular": "{1}َ{2}ِيتَ",
            "second_person_feminine_singular": "{1}َ{2}ِيتِ",
            "third_person_masculine_singular": "{1}َ{2}ِيَ",
            "third_person_feminine_singular": "{1}َ{2}ِيَتْ",
            "second_person_dual": "{1}َ{2}ِيتُمَا",
            "third_person_masculine_dual": "{1}َ{2}ِيَا",
            "third_person_feminine_dual": "{1}َ{2}ِيَتَا",
            "first_person_plural": "{1}َ{2}ِينَا",
            "second_person_masculine_plural": "{1}َ{2}ِيتُمْ",
            "second_person_feminine_plural": "{1}َ{2}ِيتُنَّ",
            "third_person_masculine_plural": "{1}َ{2}ُّوا",
            "third_person_feminine_plural": "{1}َ{2}ِينَ"
          },
          "imperative": {
            "second_person_masculine_singular": "اِ{1}ْ{2}َ",
            "second_person_feminine_singular": "اِ{1}ْ{2}َيْ",
            "second_person_dual": "اِ{1}ْ{2}َيَا",
            "second_person_masculine_plural": "اِ{1}ْ{2}َوْا",
            "second_person_feminine_plural": "اِ{1}ْ{2}َيْنَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أَ{1}ْ{2}َا",
            "second_person_masculine_singular": "تَ{1}ْ{2}َا",
            "second_person_feminine_singular": "تَ{1}ْ{2}َيْنَ",
            "third_person_masculine_singular": "يَ{1}ْ{2}َا",
            "third_person_feminine_singular": "تَ{1}ْ{2}َا",
            "second_person_dual": "تَ{1}ْ{2}َيَانِ",
            "third_person_masculine_dual": "يَ{1}ْ{2}َيَانِ",
            "third_person_feminine_dual": "تَ{1}ْ{2}َيَانِ",
            "first_person_plural": "نَ{1}ْ{2}َا",
            "second_person_masculine_plural": "تَ{1}ْ{2}َوْنَ",
            "second_person_feminine_plural": "تَ{1}ْ{2}َيْنَ",
            "third_person_masculine_plural": "يَ{1}ْ{2}َوْنَ",
            "third_person_feminine_plural": "يَ{1}ْ{2}َيْنَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أَ{1}ْ{2}َا",
            "second_person_masculine_singular": "تَ{1}ْ{2}َا",
            "second_person_feminine_singular": "تَ{1}ْ{2}َيْ",
            "third_person_masculine_singular": "يَ{1}ْ{2}َا",
            "third_person_feminine_singular": "تَ{1}ْ{2}َا",
            "second_person_dual": "تَ{1}ْ{2}َيَا",
            "third_person_masculine_dual": "يَ{1}ْ{2}َيَا",
            "third_person_feminine_dual": "تَ{1}ْ{2}َيَا",
            "first_person_plural": "نَ{1}ْ{2}َا",
            "second_person_masculine_plural": "تَ{1}ْ{2}َوْا",
            "second_person_feminine_plural": "تَ{1}ْ{2}َيْنَ",
            "third_person_masculine_plural": "يَ{1}ْ{2}َوْا",
            "third_person_feminine_plural": "يَ{1}ْ{2}َيْنَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أَ{1}ْ{2}َ",
            "second_person_masculine_singular": "تَ{1}ْ{2}َ",
            "second_person_feminine_singular": "تَ{1}ْ{2}َيْ",
            "third_person_masculine_singular": "يَ{1}ْ{2}َ",
            "third_person_feminine_singular": "تَ{1}ْ{2}َ",
            "second_person_dual": "تَ{1}ْ{2}َيَا",
            "third_person_masculine_dual": "يَ{1}ْ{2}َيَا",
            "third_person_feminine_dual": "تَ{1}ْ{2}َيَا",
            "first_person_plural": "نَ{1}ْ{2}َ",
            "second_person_masculine_plural": "تَ{1}ْ{2}َوْا",
            "second_person_feminine_plural": "تَ{1}ْ{2}َيْنَ",
            "third_person_masculine_plural": "يَ{1}ْ{2}َوْا",
            "third_person_feminine_plural": "يَ{1}ْ{2}َيْنَ"
          }
        }'::jsonb,
        TRUE,
        TRUE,
        'sound',
        'ya',
        'ya',
        FALSE,
        'i',
        'a');

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('حيي', 1, 'i', 'a', morph_pattern_id_for_code('f1-i-a-hollow-ya-final-weak'),
        'حَيِيَ يَحْيَا writes its final ā with alif after ي and contracts the 3rd plural حَيُّوا, Wright vol. I §179 rem. a and b.');
