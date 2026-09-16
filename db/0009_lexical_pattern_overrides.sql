UPDATE morph_pattern
SET description = 'a ~ a, final-weak, hamzated middle, hamza elided',
    is_lexical  = TRUE
WHERE form_number = 1
  AND description = 'a ~ a, final-weak, hamzated middle'
  AND rules -> 'imperfect_indicative' ->> 'third_person_masculine_singular' NOT LIKE '%{2}%';

INSERT INTO morph_pattern (form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
SELECT form_number,
       vocalic_template,
       'a ~ a, final-weak, hamzated middle',
       rules,
       no_affix,
       FALSE,
       radical1_kind,
       'hamza'::radical_kind,
       'ya'::radical_kind,
       is_geminate,
       perfect_vowel,
       imperfect_vowel
FROM morph_pattern
WHERE form_number = 1
  AND description = 'a ~ a, final-weak'
ON CONFLICT (form_number, description) DO NOTHING;

INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, morph_pattern_id, note)
SELECT strip_root_noise('رأي'),
       1,
       'a',
       'a',
       id,
       'رأى elides the hamza of its second radical throughout the imperfect and the imperative. '
         'The root shape is otherwise regular, as نأى / يَنْأَى shows, so this belongs to the verb rather than to the shape.'
FROM morph_pattern
WHERE form_number = 1
  AND description = 'a ~ a, final-weak, hamzated middle, hamza elided'
ON CONFLICT ON CONSTRAINT unique_lexical_pattern_override_key DO NOTHING;

UPDATE lexical_entry e
SET morph_pattern_id = shape.id
FROM morph_pattern lexical,
     morph_pattern shape
WHERE lexical.form_number = 1
  AND lexical.description = 'a ~ a, final-weak, hamzated middle, hamza elided'
  AND shape.form_number = 1
  AND shape.description = 'a ~ a, final-weak, hamzated middle'
  AND e.morph_pattern_id = lexical.id
  AND NOT EXISTS (SELECT 1
                  FROM lexical_pattern_override o
                  WHERE o.morph_pattern_id = lexical.id
                    AND o.root = strip_root_noise(e.root));

SELECT regenerate_all_derived_stems();
