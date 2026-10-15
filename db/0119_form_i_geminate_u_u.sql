INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
SELECT 'f1-u-u-geminate',
       1,
       sound.vocalic_template,
       'u ~ u, geminate',
       (base.rules - 'masdar' - 'active_participle' - 'passive_participle' - 'passive_perfect'
                   - 'passive_imperfect_indicative' - 'passive_imperfect_subjunctive' - 'passive_imperfect_jussive')
         || jsonb_build_object(
              'active_participle', '{1}َ{2}ِي{3}',
              'perfect', (base.rules -> 'perfect') || jsonb_build_object(
                'first_person_singular', '{1}َ{2}ُ{3}ْتُ',
                'second_person_masculine_singular', '{1}َ{2}ُ{3}ْتَ',
                'second_person_feminine_singular', '{1}َ{2}ُ{3}ْتِ',
                'second_person_dual', '{1}َ{2}ُ{3}ْتُمَا',
                'first_person_plural', '{1}َ{2}ُ{3}ْنَا',
                'second_person_masculine_plural', '{1}َ{2}ُ{3}ْتُمْ',
                'second_person_feminine_plural', '{1}َ{2}ُ{3}ْتُنَّ',
                'third_person_feminine_plural', '{1}َ{2}ُ{3}ْنَ')),
       base.no_affix,
       FALSE,
       'sound',
       'sound',
       'sound',
       TRUE,
       'u',
       'u'
FROM morph_pattern base
JOIN morph_pattern sound ON sound.code = 'f1-u-u'
WHERE base.code = 'f1-a-u-geminate';

INSERT INTO morph_pattern_alternative (morph_pattern_id, root, voice, mood, person, ordinal, template, verbatim, note)
SELECT morph_pattern_id_for_code('f1-u-u-geminate'), a.root, a.voice, a.mood, a.person, a.ordinal, a.template,
       a.verbatim, a.note
FROM morph_pattern_alternative a
WHERE a.morph_pattern_id = morph_pattern_id_for_code('f1-a-u-geminate')
  AND a.voice = 'active';
