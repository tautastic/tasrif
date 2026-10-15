INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
SELECT 'f1-a-a-final-weak-waw',
       1,
       waw.vocalic_template,
       'a ~ a, final-weak waw',
       (waw.rules - 'masdar')
         || jsonb_build_object(
              'imperfect_indicative', alif.rules -> 'imperfect_indicative',
              'imperfect_subjunctive', alif.rules -> 'imperfect_subjunctive',
              'imperfect_jussive', alif.rules -> 'imperfect_jussive',
              'imperative', alif.rules -> 'imperative'),
       waw.no_affix,
       FALSE,
       'sound',
       'sound',
       'waw',
       FALSE,
       'a',
       'a'
FROM morph_pattern waw
JOIN morph_pattern alif ON alif.code = 'f1-i-a-final-weak-waw'
WHERE waw.code = 'f1-a-u-final-weak-waw';
