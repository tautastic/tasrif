CREATE OR REPLACE FUNCTION normalize_arabic_remove_tatweel
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REPLACE(input, 'ـ', '')
$$;

CREATE OR REPLACE FUNCTION normalize_arabic_alef_maqsura
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REPLACE(input, 'ی', 'ى')
$$;

CREATE OR REPLACE FUNCTION normalize_arabic_initial_hamza
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REGEXP_REPLACE(
         REGEXP_REPLACE(
           REGEXP_REPLACE(input, '^ءَ', 'أَ', 'g'),
           '^ءُ',
           'أُ',
           'g'
         ),
         '^ءِ',
         'إِ',
         'g'
       )
$$;

CREATE OR REPLACE FUNCTION normalize_arabic_gemination
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REGEXP_REPLACE(input, '([ء-غف-ي])ْ\1', '\1ّ', 'g')
$$;

CREATE OR REPLACE FUNCTION normalize_arabic_hamza_assimilation
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REGEXP_REPLACE(
         REGEXP_REPLACE(input, 'أَأْ', 'آ', 'g'),
         'أَا',
         'آ',
         'g'
       )
$$;

CREATE OR REPLACE FUNCTION normalize_arabic_hamza_seating_alif
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REGEXP_REPLACE(
         REGEXP_REPLACE(input, 'اِأْ', 'اِئْ', 'g'),
         'اُأْ',
         'اُؤْ',
         'g'
       )
$$;

CREATE OR REPLACE FUNCTION normalize_arabic_hamza_seating_bare
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REGEXP_REPLACE(
         REGEXP_REPLACE(
           REGEXP_REPLACE(input, '(َ)(ّ?)ء', '\1\2أ', 'g'),
           '(ُ)(ّ?)ء',
           '\1\2ؤ',
           'g'
         ),
         '(ِ)(ّ?)ء',
         '\1\2ئ',
         'g'
       )
$$;

CREATE OR REPLACE FUNCTION normalize_arabic_hamza_seating_waw_yeh
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REGEXP_REPLACE(
         REGEXP_REPLACE(input, 'أُو', 'ؤُو', 'g'),
         'أِي',
         'ئِي',
         'g'
       )
$$;

CREATE OR REPLACE FUNCTION normalize_arabic_long_vowels
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REGEXP_REPLACE(
         REGEXP_REPLACE(input, '(ُ)وْ', '\1و', 'g'),
         '(ِ)يْ',
         '\1ي',
         'g'
       )
$$;

CREATE OR REPLACE FUNCTION normalize_arabic_orthography
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT normalize_arabic_long_vowels(
         normalize_arabic_hamza_assimilation(
           normalize_arabic_hamza_seating_alif(
             normalize_arabic_hamza_seating_waw_yeh(
               normalize_arabic_hamza_seating_bare(
                 normalize_arabic_initial_hamza(
                   normalize_arabic_gemination(
                     normalize_arabic_alef_maqsura(
                       normalize_arabic_remove_tatweel(input)
                     )
                   )
                 )
               )
             )
           )
         )
       )
$$;