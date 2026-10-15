INSERT INTO morph_pattern (code, form_number, radical_count, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, radical4_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
VALUES ('f3-quadriliteral-final-weak',
        3,
        4,
        'اِفْعَنْلَى',
        'quadriliteral final-weak',
        '{
          "masdar": "اِ{1}ْ{2}ِنْ{3}َاء",
          "perfect": {
            "first_person_singular": "اِ{1}ْ{2}َنْ{3}َ{4}ْتُ",
            "second_person_masculine_singular": "اِ{1}ْ{2}َنْ{3}َ{4}ْتَ",
            "second_person_feminine_singular": "اِ{1}ْ{2}َنْ{3}َ{4}ْتِ",
            "third_person_masculine_singular": "اِ{1}ْ{2}َنْ{3}َى",
            "third_person_feminine_singular": "اِ{1}ْ{2}َنْ{3}َتْ",
            "second_person_dual": "اِ{1}ْ{2}َنْ{3}َ{4}ْتُمَا",
            "third_person_masculine_dual": "اِ{1}ْ{2}َنْ{3}َ{4}َا",
            "third_person_feminine_dual": "اِ{1}ْ{2}َنْ{3}َتَا",
            "first_person_plural": "اِ{1}ْ{2}َنْ{3}َ{4}ْنَا",
            "second_person_masculine_plural": "اِ{1}ْ{2}َنْ{3}َ{4}ْتُمْ",
            "second_person_feminine_plural": "اِ{1}ْ{2}َنْ{3}َ{4}ْتُنَّ",
            "third_person_masculine_plural": "اِ{1}ْ{2}َنْ{3}َوْا",
            "third_person_feminine_plural": "اِ{1}ْ{2}َنْ{3}َ{4}ْنَ"
          },
          "imperative": {
            "second_person_masculine_singular": "اِ{1}ْ{2}َنْ{3}ِ",
            "second_person_feminine_singular": "اِ{1}ْ{2}َنْ{3}ِي",
            "second_person_dual": "اِ{1}ْ{2}َنْ{3}ِ{4}َا",
            "second_person_masculine_plural": "اِ{1}ْ{2}َنْ{3}ُوا",
            "second_person_feminine_plural": "اِ{1}ْ{2}َنْ{3}ِ{4}نَ"
          },
          "imperfect_indicative": {
            "first_person_singular": "أَ{1}ْ{2}َنْ{3}ِ{4}",
            "second_person_masculine_singular": "تَ{1}ْ{2}َنْ{3}ِ{4}",
            "second_person_feminine_singular": "تَ{1}ْ{2}َنْ{3}ِينَ",
            "third_person_masculine_singular": "يَ{1}ْ{2}َنْ{3}ِ{4}",
            "third_person_feminine_singular": "تَ{1}ْ{2}َنْ{3}ِ{4}",
            "second_person_dual": "تَ{1}ْ{2}َنْ{3}ِ{4}َانِ",
            "third_person_masculine_dual": "يَ{1}ْ{2}َنْ{3}ِ{4}َانِ",
            "third_person_feminine_dual": "تَ{1}ْ{2}َنْ{3}ِ{4}َانِ",
            "first_person_plural": "نَ{1}ْ{2}َنْ{3}ِ{4}",
            "second_person_masculine_plural": "تَ{1}ْ{2}َنْ{3}ُونَ",
            "second_person_feminine_plural": "تَ{1}ْ{2}َنْ{3}ِ{4}نَ",
            "third_person_masculine_plural": "يَ{1}ْ{2}َنْ{3}ُونَ",
            "third_person_feminine_plural": "يَ{1}ْ{2}َنْ{3}ِ{4}نَ"
          },
          "imperfect_subjunctive": {
            "first_person_singular": "أَ{1}ْ{2}َنْ{3}ِ{4}َ",
            "second_person_masculine_singular": "تَ{1}ْ{2}َنْ{3}ِ{4}َ",
            "second_person_feminine_singular": "تَ{1}ْ{2}َنْ{3}ِي",
            "third_person_masculine_singular": "يَ{1}ْ{2}َنْ{3}ِ{4}َ",
            "third_person_feminine_singular": "تَ{1}ْ{2}َنْ{3}ِ{4}َ",
            "second_person_dual": "تَ{1}ْ{2}َنْ{3}ِ{4}َا",
            "third_person_masculine_dual": "يَ{1}ْ{2}َنْ{3}ِ{4}َا",
            "third_person_feminine_dual": "تَ{1}ْ{2}َنْ{3}ِ{4}َا",
            "first_person_plural": "نَ{1}ْ{2}َنْ{3}ِ{4}َ",
            "second_person_masculine_plural": "تَ{1}ْ{2}َنْ{3}ُوا",
            "second_person_feminine_plural": "تَ{1}ْ{2}َنْ{3}ِ{4}نَ",
            "third_person_masculine_plural": "يَ{1}ْ{2}َنْ{3}ُوا",
            "third_person_feminine_plural": "يَ{1}ْ{2}َنْ{3}ِ{4}نَ"
          },
          "imperfect_jussive": {
            "first_person_singular": "أَ{1}ْ{2}َنْ{3}ِ",
            "second_person_masculine_singular": "تَ{1}ْ{2}َنْ{3}ِ",
            "second_person_feminine_singular": "تَ{1}ْ{2}َنْ{3}ِي",
            "third_person_masculine_singular": "يَ{1}ْ{2}َنْ{3}ِ",
            "third_person_feminine_singular": "تَ{1}ْ{2}َنْ{3}ِ",
            "second_person_dual": "تَ{1}ْ{2}َنْ{3}ِ{4}َا",
            "third_person_masculine_dual": "يَ{1}ْ{2}َنْ{3}ِ{4}َا",
            "third_person_feminine_dual": "تَ{1}ْ{2}َنْ{3}ِ{4}َا",
            "first_person_plural": "نَ{1}ْ{2}َنْ{3}ِ",
            "second_person_masculine_plural": "تَ{1}ْ{2}َنْ{3}ُوا",
            "second_person_feminine_plural": "تَ{1}ْ{2}َنْ{3}ِ{4}نَ",
            "third_person_masculine_plural": "يَ{1}ْ{2}َنْ{3}ُوا",
            "third_person_feminine_plural": "يَ{1}ْ{2}َنْ{3}ِ{4}نَ"
          },
          "active_participle": "مُ{1}ْ{2}َنْ{3}ٍ",
          "passive_participle": "مُ{1}ْ{2}َنْ{3}ًى"
        }'::jsonb,
        TRUE, FALSE,
        'sound', 'sound', 'sound', 'ya', FALSE,
        NULL, NULL);

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
VALUES ('سلقي', 3, NULL, NULL, morph_pattern_id_for_code('f3-quadriliteral-final-weak'), 'sample root of the final-weak quadriliteral form III pattern, which shape resolution reaches for every root with a final ya');
