CREATE OR REPLACE FUNCTION canonical_hamza_root
(
  root_text TEXT
) RETURNS TEXT
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT TRANSLATE(root_text, U&'\0623\0625\0622\0624\0626', U&'\0621\0621\0621\0621\0621')
$$;

CREATE OR REPLACE FUNCTION replace_root_placeholders
(
  template_text TEXT, c1 TEXT, c2 TEXT, c3 TEXT
) RETURNS TEXT
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REPLACE(
         REPLACE(
           REPLACE(template_text, '{1}', canonical_hamza_root(c1)),
           '{2}',
           canonical_hamza_root(c2)
         ),
         '{3}',
         canonical_hamza_root(c3)
       )
$$;

CREATE OR REPLACE FUNCTION seat_bare_hamzas
(
  input text
) RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE AS
$$
DECLARE
  hamza CONSTANT text := U&'\0621';
  letters CONSTANT text := '[ء-ي]';
  chars text[] := REGEXP_SPLIT_TO_ARRAY(input, '');
  total CONSTANT integer := CARDINALITY(chars);
  result text := '';
  idx integer;
  before integer;
  after integer;
  mark text;
  preceding text;
  own text;
  is_final boolean;
  seat text;
BEGIN
  FOR idx IN 1..total
    LOOP
      IF chars[idx] <> hamza THEN
        result := result || chars[idx];
        CONTINUE;
      END IF;

      before := idx - 1;
      IF before >= 1 AND chars[before] = U&'\0651' THEN
        before := before - 1;
      END IF;
      IF before < 1 THEN
        preceding := 'start';
      ELSE
        mark := chars[before];
        preceding := CASE
                       WHEN mark = U&'\064E' THEN 'a'
                       WHEN mark = U&'\064F' THEN 'u'
                       WHEN mark = U&'\0650' THEN 'i'
                       WHEN mark = U&'\0652' THEN CASE
                                                    WHEN before > 1 AND chars[before - 1] = U&'\064A' THEN 'yeh-sukun'
                                                    WHEN before > 1 AND chars[before - 1] = U&'\0648' THEN 'waw-sukun'
                                                    ELSE 'sukun'
                                                  END
                       WHEN mark IN (U&'\0627', U&'\0622', U&'\0649') THEN 'long-a'
                       WHEN mark = U&'\0648' THEN 'long-u'
                       WHEN mark = U&'\064A' THEN 'long-i'
                       WHEN mark ~ '[\u0621-\u0652]' THEN 'sukun'
                       ELSE 'start'
                     END;
      END IF;

      after := idx + 1;
      IF after <= total AND chars[after] = U&'\0651' THEN
        after := after + 1;
      END IF;
      own := 'none';
      IF after <= total THEN
        mark := chars[after];
        IF mark IN (U&'\064E', U&'\064B') THEN
          own := 'a';
          after := after + 1;
        ELSIF mark IN (U&'\064F', U&'\064C') THEN
          own := 'u';
          after := after + 1;
        ELSIF mark IN (U&'\0650', U&'\064D') THEN
          own := 'i';
          after := after + 1;
        ELSIF mark = U&'\0652' THEN
          after := after + 1;
        END IF;
      END IF;
      IF after <= total AND chars[after] = U&'\0651' THEN
        after := after + 1;
      END IF;
      is_final := after > total OR chars[after] !~ letters;

      seat := CASE
                WHEN preceding = 'start' THEN CASE own WHEN 'i' THEN U&'\0625' ELSE U&'\0623' END
                WHEN is_final AND preceding <> 'sukun' THEN CASE preceding
                                                              WHEN 'a' THEN U&'\0623'
                                                              WHEN 'u' THEN U&'\0624'
                                                              WHEN 'i' THEN U&'\0626'
                                                              ELSE hamza
                                                            END
                WHEN preceding IN ('yeh-sukun', 'long-i', 'i') THEN U&'\0626'
                WHEN preceding = 'long-a' THEN CASE own
                                                 WHEN 'u' THEN U&'\0624'
                                                 WHEN 'i' THEN U&'\0626'
                                                 ELSE hamza
                                               END
                WHEN preceding IN ('long-u', 'waw-sukun') THEN CASE own WHEN 'i' THEN U&'\0626' ELSE hamza END
                WHEN preceding = 'u' THEN CASE own WHEN 'i' THEN U&'\0626' ELSE U&'\0624' END
                WHEN preceding = 'a' THEN CASE own
                                            WHEN 'i' THEN U&'\0626'
                                            WHEN 'u' THEN U&'\0624'
                                            ELSE U&'\0623'
                                          END
                ELSE CASE own
                       WHEN 'i' THEN U&'\0626'
                       WHEN 'u' THEN U&'\0624'
                       WHEN 'a' THEN U&'\0623'
                       ELSE hamza
                     END
              END;
      result := result || seat;
    END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_arabic_hamza_seating_bare
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT CASE WHEN POSITION(U&'\0621' IN input) > 0 THEN seat_bare_hamzas(input) ELSE input END
$$;

CREATE OR REPLACE FUNCTION resolve_morph_pattern_id
(
  root_text TEXT,
  target_form_number INTEGER,
  target_perfect_vowel short_vowel DEFAULT NULL,
  target_imperfect_vowel short_vowel DEFAULT NULL
) RETURNS INTEGER
  LANGUAGE plpgsql
  STABLE AS
$$
DECLARE
  classification root_classification;
  resolved_id     INTEGER;
BEGIN
  IF target_form_number = 1 AND (target_perfect_vowel IS NULL OR target_imperfect_vowel IS NULL) THEN
    RAISE EXCEPTION 'form I requires both a perfect and an imperfect vowel'
      USING ERRCODE = '22023';
  END IF;

  IF target_form_number != 1 AND (target_perfect_vowel IS NOT NULL OR target_imperfect_vowel IS NOT NULL) THEN
    RAISE EXCEPTION 'perfect/imperfect vowels only apply to form I, got form %', target_form_number
      USING ERRCODE = '22023';
  END IF;

  SELECT morph_pattern_id
  INTO resolved_id
  FROM lexical_pattern_override
  WHERE canonical_hamza_root(root) = canonical_hamza_root(strip_root_noise(root_text))
    AND form_number = target_form_number
    AND perfect_vowel IS NOT DISTINCT FROM target_perfect_vowel
    AND imperfect_vowel IS NOT DISTINCT FROM target_imperfect_vowel
  ORDER BY id
  LIMIT 1;

  IF resolved_id IS NOT NULL THEN
    RETURN resolved_id;
  END IF;

  classification := classify_root(root_text);

  SELECT morph_pattern_id
  INTO resolved_id
  FROM morph_pattern_resolution
  WHERE form_number = target_form_number
    AND perfect_vowel IS NOT DISTINCT FROM target_perfect_vowel
    AND imperfect_vowel IS NOT DISTINCT FROM target_imperfect_vowel
    AND radical1_kind = classification.radical1
    AND radical2_kind = classification.radical2
    AND radical3_kind = classification.radical3
    AND is_geminate = classification.is_geminate;

  RETURN resolved_id;
END;
$$;
