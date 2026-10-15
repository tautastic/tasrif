INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
SELECT 'f1-u-u-final-weak-waw',
       base.form_number,
       'فَعُلَ',
       'u ~ u, final-weak waw',
       (base.rules - 'masdar' - 'active_participle' - 'passive_participle' - 'perfect' - 'passive_perfect'
         - 'passive_imperfect_stem' - 'passive_imperfect_indicative' - 'passive_imperfect_subjunctive'
         - 'passive_imperfect_jussive')
         || jsonb_build_object(
              'perfect',
              jsonb_build_object(
                'first_person_singular', '{1}َ{2}ُوتُ',
                'second_person_masculine_singular', '{1}َ{2}ُوتَ',
                'second_person_feminine_singular', '{1}َ{2}ُوتِ',
                'third_person_masculine_singular', '{1}َ{2}ُوَ',
                'third_person_feminine_singular', '{1}َ{2}ُوَتْ',
                'second_person_dual', '{1}َ{2}ُوتُمَا',
                'third_person_masculine_dual', '{1}َ{2}ُوَا',
                'third_person_feminine_dual', '{1}َ{2}ُوَتَا',
                'first_person_plural', '{1}َ{2}ُونَا',
                'second_person_masculine_plural', '{1}َ{2}ُوتُمْ',
                'second_person_feminine_plural', '{1}َ{2}ُوتُنَّ',
                'third_person_masculine_plural', '{1}َ{2}ُوا',
                'third_person_feminine_plural', '{1}َ{2}ُونَ')),
       base.no_affix,
       FALSE,
       'sound',
       'sound',
       'waw',
       FALSE,
       'u',
       'u'
FROM morph_pattern base
WHERE base.code = 'f1-a-u-final-weak-waw';
