CREATE OR REPLACE FUNCTION normalize_arabic_hamza_seating_waw_yeh
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REGEXP_REPLACE(
         REGEXP_REPLACE(input, '([^[:space:]])أُو', '\1ؤُو', 'g'),
         '([^[:space:]])أِي',
         '\1ئِي',
         'g'
       )
$$;

SELECT regenerate_derived_stems(ARRAY(SELECT id
                                      FROM lexical_entry
                                      WHERE morph_pattern_id IS NOT NULL
                                        AND strip_root_noise(root) ~ '[وي]'
                                      ORDER BY id));
