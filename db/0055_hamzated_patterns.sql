CREATE OR REPLACE FUNCTION normalize_arabic_hamza_assimilation
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REPLACE(
         REPLACE(
           REGEXP_REPLACE(
             REGEXP_REPLACE(input, 'أَأْ', 'آ', 'g'),
             'أَا',
             'آ',
             'g'
           ),
           U&'\0623\064F\0624\0652',
           U&'\0623\064F\0648'
         ),
         U&'\0625\0650\0626\0652',
         U&'\0625\0650\064A'
       )
$$;

UPDATE morph_pattern target
SET rules = target.rules || jsonb_build_object(
      'masdar', (SELECT sound.rules -> 'masdar' FROM morph_pattern sound WHERE sound.code = 'f1-a-a'),
      'active_participle', (SELECT sound.rules -> 'active_participle' FROM morph_pattern sound WHERE sound.code = 'f1-a-a'),
      'passive_participle', (SELECT sound.rules -> 'passive_participle' FROM morph_pattern sound WHERE sound.code = 'f1-a-a'))
WHERE target.code = 'f1-a-a-hamzated-third'
  AND NOT target.rules ? 'masdar';

UPDATE morph_pattern target
SET rules = target.rules || jsonb_build_object(
      'masdar', (SELECT sound.rules -> 'masdar' FROM morph_pattern sound WHERE sound.code = 'f5'),
      'active_participle', (SELECT sound.rules -> 'active_participle' FROM morph_pattern sound WHERE sound.code = 'f5'))
WHERE target.code = 'f5-hamzated-second'
  AND NOT target.rules ? 'masdar';

UPDATE morph_pattern target
SET rules = target.rules || jsonb_build_object(
      'masdar', (SELECT sound.rules -> 'masdar' FROM morph_pattern sound WHERE sound.code = 'f5'),
      'active_participle', (SELECT sound.rules -> 'active_participle' FROM morph_pattern sound WHERE sound.code = 'f5'))
WHERE target.code = 'f5-hamzated-third'
  AND NOT target.rules ? 'masdar';

UPDATE morph_pattern target
SET rules = target.rules || jsonb_build_object(
      'masdar', (SELECT sound.rules -> 'masdar' FROM morph_pattern sound WHERE sound.code = 'f6'),
      'active_participle', (SELECT sound.rules -> 'active_participle' FROM morph_pattern sound WHERE sound.code = 'f6'))
WHERE target.code = 'f6-hamzated-third'
  AND NOT target.rules ? 'masdar';

UPDATE morph_pattern target
SET rules = target.rules || jsonb_build_object(
      'masdar', (SELECT sound.rules -> 'masdar' FROM morph_pattern sound WHERE sound.code = 'f10'))
WHERE target.code = 'f10-hamzated-first'
  AND NOT target.rules ? 'masdar';

SELECT add_morph_pattern_resolution('f1-a-a', 'سأل');

SELECT add_morph_pattern_resolution('f1-a-u', 'دأب');

SELECT add_morph_pattern_resolution('f1-a-u', 'هنأ');

SELECT add_morph_pattern_resolution('f1-a-i', 'زأر');

SELECT add_morph_pattern_resolution('f1-a-i', 'هنأ');

SELECT add_morph_pattern_resolution('f1-i-a', 'سئم');

SELECT add_morph_pattern_resolution('f1-i-a', 'برأ');

SELECT add_morph_pattern_resolution('f1-u-u', 'بؤس');

SELECT add_morph_pattern_resolution('f1-u-u', 'جرؤ');

SELECT add_morph_pattern_resolution('f2', 'رأس');

SELECT add_morph_pattern_resolution('f2', 'برأ');

SELECT add_morph_pattern_resolution('f2', 'أكد');

SELECT add_morph_pattern_resolution('f3', 'أخذ');

SELECT add_morph_pattern_resolution('f3', 'فجأ');

SELECT add_morph_pattern_resolution('f4', 'نشأ');

SELECT add_morph_pattern_resolution('f4', 'أمن');

SELECT add_morph_pattern_resolution('f7', 'طفأ');

SELECT add_morph_pattern_resolution('f8', 'ألف');

SELECT add_morph_pattern_resolution('f8', 'بدأ');

SELECT add_morph_pattern_resolution('f10', 'هزأ');

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
SELECT 'f1-a-i-hollow-ya-hamzated-third',
       base.form_number,
       base.vocalic_template,
       'a ~ i, hollow ya, hamzated third',
       base.rules || '{"active_participle": "{1}َا{3}ٍ"}'::jsonb,
       base.no_affix,
       FALSE,
       'sound',
       'ya',
       'hamza',
       FALSE,
       base.perfect_vowel,
       base.imperfect_vowel
FROM morph_pattern base
WHERE base.code = 'f1-a-i-hollow-ya';

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
SELECT 'f1-i-a-hollow-ya-hamzated-third',
       base.form_number,
       base.vocalic_template,
       'i ~ a, hollow ya, hamzated third',
       base.rules || '{"active_participle": "{1}َا{3}ٍ"}'::jsonb,
       base.no_affix,
       FALSE,
       'sound',
       'ya',
       'hamza',
       FALSE,
       base.perfect_vowel,
       base.imperfect_vowel
FROM morph_pattern base
WHERE base.code = 'f1-i-a-hollow-ya';

INSERT INTO morph_pattern (code, form_number, vocalic_template, description, rules, no_affix, is_lexical,
                           radical1_kind, radical2_kind, radical3_kind, is_geminate,
                           perfect_vowel, imperfect_vowel)
SELECT 'f1-a-u-hollow-waw-hamzated-third',
       base.form_number,
       base.vocalic_template,
       'a ~ u, hollow waw, hamzated third',
       base.rules || '{"active_participle": "{1}َا{3}ٍ"}'::jsonb,
       base.no_affix,
       FALSE,
       'sound',
       'waw',
       'hamza',
       FALSE,
       base.perfect_vowel,
       base.imperfect_vowel
FROM morph_pattern base
WHERE base.code = 'f1-a-u-hollow-waw';
