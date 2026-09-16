DO
$do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'root_classification'
                   AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE root_classification AS (
      radical1 radical_kind,
      radical2 radical_kind,
      radical3 radical_kind,
      is_geminate boolean
    );
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION classify_root_radical
(
  radical TEXT
) RETURNS radical_kind
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT CASE
         WHEN radical = 'و' THEN 'waw'::radical_kind
         WHEN radical = 'ي' THEN 'ya'::radical_kind
         WHEN radical IN ('ء', 'أ', 'إ', 'آ', 'ؤ', 'ئ') THEN 'hamza'::radical_kind
         ELSE 'sound'::radical_kind
         END
$$;

CREATE OR REPLACE FUNCTION classify_root
(
  root_text TEXT
) RETURNS root_classification
  LANGUAGE plpgsql
  IMMUTABLE AS
$$
DECLARE
  cleaned TEXT;
  letters TEXT[];
BEGIN
  cleaned := strip_root_noise(root_text);
  letters := ARRAY(SELECT SUBSTRING(cleaned FROM n FOR 1) FROM GENERATE_SERIES(1, CHAR_LENGTH(cleaned)) AS n);

  IF COALESCE(ARRAY_LENGTH(letters, 1), 0) != 3 THEN
    RAISE EXCEPTION 'root ''%'' must have exactly 3 radicals after normalization, found %',
      root_text, COALESCE(ARRAY_LENGTH(letters, 1), 0)
      USING ERRCODE = '22023';
  END IF;

  RETURN ROW(
    classify_root_radical(letters[1]),
    classify_root_radical(letters[2]),
    classify_root_radical(letters[3]),
    letters[2] = letters[3] AND classify_root_radical(letters[2]) = 'sound'
  )::root_classification;
END;
$$;

CREATE OR REPLACE FUNCTION root_classification_labels
(
  classification root_classification
) RETURNS TEXT[]
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT CASE WHEN COALESCE(ARRAY_LENGTH(labels, 1), 0) = 0 THEN ARRAY ['sound'] ELSE labels END
FROM (
       SELECT ARRAY_REMOVE(ARRAY [
         CASE WHEN classification.radical1 IN ('waw', 'ya') THEN 'assimilated' END,
         CASE WHEN classification.radical2 IN ('waw', 'ya') THEN 'hollow' END,
         CASE WHEN classification.radical3 IN ('waw', 'ya') THEN 'final-weak' END,
         CASE WHEN classification.is_geminate THEN 'geminate' END,
         CASE
           WHEN 'hamza' IN (classification.radical1, classification.radical2, classification.radical3)
             THEN 'hamzated' END
         ], NULL) AS labels
     ) AS labeled
$$;

CREATE OR REPLACE FUNCTION describe_root
(
  root_text TEXT
) RETURNS TEXT[]
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT root_classification_labels(classify_root(root_text))
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
  WHERE root = strip_root_noise(root_text)
    AND form_number = target_form_number
    AND perfect_vowel IS NOT DISTINCT FROM target_perfect_vowel
    AND imperfect_vowel IS NOT DISTINCT FROM target_imperfect_vowel;

  IF resolved_id IS NOT NULL THEN
    RETURN resolved_id;
  END IF;

  classification := classify_root(root_text);

  SELECT id
  INTO resolved_id
  FROM morph_pattern
  WHERE NOT is_lexical
    AND form_number = target_form_number
    AND radical1_kind = classification.radical1
    AND radical2_kind = classification.radical2
    AND radical3_kind = classification.radical3
    AND is_geminate = classification.is_geminate
    AND perfect_vowel IS NOT DISTINCT FROM target_perfect_vowel
    AND imperfect_vowel IS NOT DISTINCT FROM target_imperfect_vowel
  ORDER BY id
  LIMIT 1;

  RETURN resolved_id;
END;
$$;

UPDATE morph_pattern SET perfect_vowel = 'a', imperfect_vowel = 'u' WHERE form_number = 1 AND description = 'a ~ u';
UPDATE morph_pattern SET perfect_vowel = 'a', imperfect_vowel = 'a' WHERE form_number = 1 AND description = 'a ~ a';
UPDATE morph_pattern SET perfect_vowel = 'a', imperfect_vowel = 'i' WHERE form_number = 1 AND description = 'a ~ i';
UPDATE morph_pattern SET perfect_vowel = 'i', imperfect_vowel = 'i' WHERE form_number = 1 AND description = 'i ~ i';
UPDATE morph_pattern SET perfect_vowel = 'i', imperfect_vowel = 'a' WHERE form_number = 1 AND description = 'i ~ a';
UPDATE morph_pattern SET perfect_vowel = 'u', imperfect_vowel = 'u' WHERE form_number = 1 AND description = 'u ~ u';

UPDATE morph_pattern
SET perfect_vowel   = 'a',
    imperfect_vowel = 'u',
    radical2_kind   = 'waw'
WHERE form_number = 1
  AND description = 'a ~ u, hollow waw';

UPDATE morph_pattern
SET perfect_vowel   = 'a',
    imperfect_vowel = 'i',
    radical2_kind   = 'ya'
WHERE form_number = 1
  AND description = 'a ~ i, hollow ya';

UPDATE morph_pattern
SET perfect_vowel   = 'a',
    imperfect_vowel = 'a',
    radical3_kind   = 'ya'
WHERE form_number = 1
  AND description = 'a ~ a, final-weak';

UPDATE morph_pattern
SET perfect_vowel   = 'a',
    imperfect_vowel = 'a',
    radical2_kind   = 'hamza',
    radical3_kind   = 'ya'
WHERE form_number = 1
  AND description = 'a ~ a, final-weak, hamzated middle';

UPDATE morph_pattern
SET perfect_vowel   = 'a',
    imperfect_vowel = 'i',
    is_geminate     = TRUE
WHERE form_number = 1
  AND description = 'a ~ i, geminate';

UPDATE morph_pattern
SET radical3_kind = 'ya',
    description   = 'final-weak ya'
WHERE form_number = 4
  AND description = 'final-weak';

INSERT INTO morph_pattern (form_number, vocalic_template, description, rules, no_affix,
                            radical1_kind, radical2_kind, radical3_kind, is_geminate)
SELECT form_number, vocalic_template, 'final-weak waw', rules, no_affix,
       radical1_kind, radical2_kind, 'waw'::radical_kind, is_geminate
FROM morph_pattern
WHERE form_number = 4
  AND description = 'final-weak ya'
ON CONFLICT (form_number, description) DO NOTHING;

UPDATE morph_pattern
SET radical3_kind = 'ya',
    description   = 'final-weak ya'
WHERE form_number = 8
  AND description LIKE '%ya';

UPDATE morph_pattern
SET radical3_kind = 'waw',
    description   = 'final-weak waw'
WHERE form_number = 8
  AND description LIKE '%waw';

UPDATE morph_pattern
SET radical3_kind = 'ya',
    description   = 'final-weak ya'
WHERE form_number = 10
  AND description = 'final-weak';

INSERT INTO morph_pattern (form_number, vocalic_template, description, rules, no_affix,
                            radical1_kind, radical2_kind, radical3_kind, is_geminate)
SELECT form_number, vocalic_template, 'final-weak waw', rules, no_affix,
       radical1_kind, radical2_kind, 'waw'::radical_kind, is_geminate
FROM morph_pattern
WHERE form_number = 10
  AND description = 'final-weak ya'
ON CONFLICT (form_number, description) DO NOTHING;

UPDATE morph_pattern
SET radical2_kind = 'waw',
    description   = 'hollow waw'
WHERE form_number = 10
  AND description = 'hollow';

ALTER TABLE morph_pattern
  DROP CONSTRAINT IF EXISTS chk_morph_pattern_form1_vowels;

ALTER TABLE morph_pattern
  ADD CONSTRAINT chk_morph_pattern_form1_vowels
    CHECK ((form_number = 1) = (perfect_vowel IS NOT NULL AND imperfect_vowel IS NOT NULL));
