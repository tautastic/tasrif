CREATE OR REPLACE FUNCTION entry_alternative_forms
(
  p_entry_ids INTEGER[]
) RETURNS TABLE
          (
            lexical_entry_id INTEGER,
            voice            voice_type,
            mood             affix_mood,
            person           person_type,
            ordinal          SMALLINT,
            form             TEXT
          )
  LANGUAGE plpgsql
  STABLE
  ROWS 20
  SET plan_cache_mode = force_generic_plan
AS
$$
BEGIN
  RETURN QUERY
SELECT picked.entry_id, picked.voice, picked.mood, picked.person, picked.ordinal, picked.form
FROM (SELECT DISTINCT ON (e.id, a.voice, a.mood, a.person, evaluated.form) e.id AS entry_id,
                                                                            a.voice,
                                                                            a.mood,
                                                                            a.person,
                                                                            a.ordinal,
                                                                            evaluated.form
      FROM UNNEST(p_entry_ids) AS wanted (id)
             JOIN lexical_entry e ON e.id = wanted.id
             JOIN morph_pattern p ON p.id = e.morph_pattern_id
             CROSS JOIN LATERAL (SELECT strip_root_noise(e.root) AS root) cleaned
             JOIN morph_pattern_alternative a
                  ON a.morph_pattern_id = p.id
                    AND (a.root IS NULL OR canonical_hamza_root(a.root) = canonical_hamza_root(cleaned.root))
             CROSS JOIN LATERAL (SELECT CASE
                                          WHEN a.verbatim THEN placeholders.text
                                          ELSE normalize_arabic_orthography(placeholders.text)
                                          END AS form
                                 FROM (SELECT replace_root_placeholders(
                                                CASE
                                                  WHEN p.form_number = 8 AND p.radical_count = 3
                                                    THEN assimilate_form_viii_infix(TO_JSONB(a.template),
                                                                                    SUBSTRING(cleaned.root, 1, 1)) #>> '{}'
                                                  ELSE a.template
                                                  END,
                                                SUBSTRING(cleaned.root, 1, 1),
                                                SUBSTRING(cleaned.root, 2, 1),
                                                SUBSTRING(cleaned.root, 3, 1),
                                                CASE WHEN p.radical_count = 4 THEN SUBSTRING(cleaned.root, 4, 1) END
                                              ) AS text) placeholders) evaluated
      WHERE CHAR_LENGTH(cleaned.root) = p.radical_count
        AND NOT EXISTS (SELECT 1
                        FROM conjugation c
                        WHERE c.lexical_entry_id = e.id
                          AND c.voice = a.voice
                          AND c.mood = a.mood
                          AND c.person = a.person
                          AND c.form = evaluated.form)
      ORDER BY e.id, a.voice, a.mood, a.person, evaluated.form, a.ordinal) picked
ORDER BY picked.entry_id, picked.voice, picked.mood, picked.person, picked.ordinal;
END;
$$;

INSERT INTO morph_pattern_alternative (morph_pattern_id, root, mood, person, ordinal, template, note, verbatim)
SELECT morph_pattern_id_for_code(v.code), v.root, v.mood::affix_mood, v.person::person_type, v.ordinal, v.template, v.note, FALSE
FROM (VALUES
       ('f4-quadriliteral', NULL, 'imperfect_jussive', 'first_person_singular', 1, 'أَ{1}ْ{2}َ{3}ِ{4}ِّ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the jussive with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.'),
       ('f4-quadriliteral', NULL, 'imperfect_jussive', 'first_person_singular', 2, 'أَ{1}ْ{2}َ{3}ْ{4}ِ{4}ْ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the jussive with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.'),
       ('f4-quadriliteral', NULL, 'imperfect_jussive', 'second_person_masculine_singular', 1, 'تَ{1}ْ{2}َ{3}ِ{4}ِّ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the jussive with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.'),
       ('f4-quadriliteral', NULL, 'imperfect_jussive', 'second_person_masculine_singular', 2, 'تَ{1}ْ{2}َ{3}ْ{4}ِ{4}ْ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the jussive with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.'),
       ('f4-quadriliteral', NULL, 'imperfect_jussive', 'third_person_masculine_singular', 1, 'يَ{1}ْ{2}َ{3}ِ{4}ِّ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the jussive with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.'),
       ('f4-quadriliteral', NULL, 'imperfect_jussive', 'third_person_masculine_singular', 2, 'يَ{1}ْ{2}َ{3}ْ{4}ِ{4}ْ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the jussive with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.'),
       ('f4-quadriliteral', NULL, 'imperfect_jussive', 'third_person_feminine_singular', 1, 'تَ{1}ْ{2}َ{3}ِ{4}ِّ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the jussive with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.'),
       ('f4-quadriliteral', NULL, 'imperfect_jussive', 'third_person_feminine_singular', 2, 'تَ{1}ْ{2}َ{3}ْ{4}ِ{4}ْ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the jussive with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.'),
       ('f4-quadriliteral', NULL, 'imperfect_jussive', 'first_person_plural', 1, 'نَ{1}ْ{2}َ{3}ِ{4}ِّ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the jussive with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.'),
       ('f4-quadriliteral', NULL, 'imperfect_jussive', 'first_person_plural', 2, 'نَ{1}ْ{2}َ{3}ْ{4}ِ{4}ْ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the jussive with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.'),
       ('f4-quadriliteral', NULL, 'imperative', 'second_person_masculine_singular', 1, 'اِ{1}ْ{2}َ{3}ِ{4}ِّ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the imperative with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.'),
       ('f4-quadriliteral', NULL, 'imperative', 'second_person_masculine_singular', 2, 'اِ{1}ْ{2}َ{3}ْ{4}ِ{4}ْ', 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the imperative with kasra and uncontracted beside the base form; Wright vol. I §118 inflects form IVq like form IX and §123 treats form IX as not contracted.')
) AS v (code, root, mood, person, ordinal, template, note);
