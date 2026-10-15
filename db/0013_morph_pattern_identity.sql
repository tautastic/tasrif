CREATE OR REPLACE FUNCTION morph_pattern_code
(
  p_form_number INTEGER,
  p_perfect_vowel short_vowel,
  p_imperfect_vowel short_vowel,
  p_description TEXT
) RETURNS TEXT
  LANGUAGE sql
  STABLE AS
$$
WITH parts AS (
  SELECT CASE
           WHEN p_perfect_vowel IS NOT NULL AND p_imperfect_vowel IS NOT NULL
             THEN p_perfect_vowel::text || '-' || p_imperfect_vowel::text
           END AS vowels,
         BTRIM(
           REGEXP_REPLACE(
             TRANSLATE(COALESCE(p_description, ''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'),
             '[^a-z]+', '-', 'g'
           ),
           '-'
         ) AS slug
)
SELECT 'f' || p_form_number::text
         || COALESCE('-' || vowels, '')
         || COALESCE('-' || NULLIF(
                              CASE
                                WHEN vowels IS NOT NULL AND (slug = vowels OR slug LIKE vowels || '-%')
                                  THEN SUBSTRING(slug FROM CHAR_LENGTH(vowels) + 2)
                                ELSE slug
                                END,
                              ''), '')
FROM parts
$$;

CREATE OR REPLACE FUNCTION available_morph_pattern_code
(
  p_base TEXT
) RETURNS TEXT
  LANGUAGE plpgsql
  STABLE AS
$$
DECLARE
  candidate TEXT := p_base;
  suffix    INTEGER := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM morph_pattern WHERE code = candidate)
    LOOP
      suffix := suffix + 1;
      IF suffix > 26 THEN
        RAISE EXCEPTION 'every morph_pattern code derived from % is taken', p_base
          USING ERRCODE = '23505';
      END IF;
      candidate := p_base || '-' || CHR(96 + suffix);
    END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION morph_pattern_id_for_code
(
  p_code TEXT
) RETURNS INTEGER
  LANGUAGE plpgsql
  STABLE AS
$$
DECLARE
  v_id INTEGER;
BEGIN
  SELECT id INTO v_id FROM morph_pattern WHERE code = p_code;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'no morph_pattern has code %', p_code
      USING ERRCODE = 'P0002';
  END IF;
  RETURN v_id;
END;
$$;

WITH seeded (code, form_number, perfect_vowel, imperfect_vowel, radical1_kind, radical2_kind, radical3_kind,
             is_geminate, is_lexical) AS (
  VALUES ('f1-a-u', 1, 'a'::short_vowel, 'u'::short_vowel, 'sound'::radical_kind, 'sound'::radical_kind,
          'sound'::radical_kind, FALSE, FALSE),
         ('f1-a-a', 1, 'a', 'a', 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f1-a-i', 1, 'a', 'i', 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f1-i-i', 1, 'i', 'i', 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f1-i-a', 1, 'i', 'a', 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f1-u-u', 1, 'u', 'u', 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f1-a-u-hollow-waw', 1, 'a', 'u', 'sound', 'waw', 'sound', FALSE, FALSE),
         ('f1-a-i-hollow-ya', 1, 'a', 'i', 'sound', 'ya', 'sound', FALSE, FALSE),
         ('f1-a-a-final-weak', 1, 'a', 'a', 'sound', 'sound', 'ya', FALSE, FALSE),
         ('f1-a-a-final-weak-hamzated-middle', 1, 'a', 'a', 'sound', 'hamza', 'ya', FALSE, FALSE),
         ('f1-a-a-final-weak-hamzated-middle-hamza-elided', 1, 'a', 'a', 'sound', 'hamza', 'ya', FALSE, TRUE),
         ('f1-a-i-geminate', 1, 'a', 'i', 'sound', 'sound', 'sound', TRUE, FALSE),
         ('f2', 2, NULL, NULL, 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f3', 3, NULL, NULL, 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f4', 4, NULL, NULL, 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f4-final-weak-ya', 4, NULL, NULL, 'sound', 'sound', 'ya', FALSE, FALSE),
         ('f4-final-weak-waw', 4, NULL, NULL, 'sound', 'sound', 'waw', FALSE, FALSE),
         ('f5', 5, NULL, NULL, 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f6', 6, NULL, NULL, 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f7', 7, NULL, NULL, 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f8', 8, NULL, NULL, 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f8-final-weak-ya', 8, NULL, NULL, 'sound', 'sound', 'ya', FALSE, FALSE),
         ('f8-final-weak-waw', 8, NULL, NULL, 'sound', 'sound', 'waw', FALSE, FALSE),
         ('f9', 9, NULL, NULL, 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f10', 10, NULL, NULL, 'sound', 'sound', 'sound', FALSE, FALSE),
         ('f10-final-weak-ya', 10, NULL, NULL, 'sound', 'sound', 'ya', FALSE, FALSE),
         ('f10-final-weak-waw', 10, NULL, NULL, 'sound', 'sound', 'waw', FALSE, FALSE),
         ('f10-hollow-waw', 10, NULL, NULL, 'sound', 'waw', 'sound', FALSE, FALSE)
), matched AS (
  SELECT DISTINCT ON (s.code) s.code, mp.id
  FROM seeded s
  JOIN morph_pattern mp
    ON mp.form_number = s.form_number
      AND mp.perfect_vowel IS NOT DISTINCT FROM s.perfect_vowel
      AND mp.imperfect_vowel IS NOT DISTINCT FROM s.imperfect_vowel
      AND mp.radical1_kind = s.radical1_kind
      AND mp.radical2_kind = s.radical2_kind
      AND mp.radical3_kind = s.radical3_kind
      AND mp.is_geminate = s.is_geminate
      AND mp.is_lexical = s.is_lexical
  WHERE mp.code IS NULL
    AND NOT EXISTS (SELECT 1 FROM morph_pattern taken WHERE taken.code = s.code)
  ORDER BY s.code, mp.id
)
UPDATE morph_pattern mp
SET code = matched.code
FROM matched
WHERE mp.id = matched.id;

DO
$do$
DECLARE
  pending RECORD;
BEGIN
  FOR pending IN SELECT id, form_number, perfect_vowel, imperfect_vowel, description
                 FROM morph_pattern
                 WHERE code IS NULL
                 ORDER BY id
    LOOP
      UPDATE morph_pattern
      SET code = available_morph_pattern_code(
        morph_pattern_code(pending.form_number, pending.perfect_vowel, pending.imperfect_vowel, pending.description))
      WHERE id = pending.id;
    END LOOP;
END
$do$;

ALTER TABLE morph_pattern
  ALTER COLUMN code SET NOT NULL;

CREATE OR REPLACE FUNCTION assign_morph_pattern_code
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := available_morph_pattern_code(
      morph_pattern_code(NEW.form_number, NEW.perfect_vowel, NEW.imperfect_vowel, NEW.description));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_assign_morph_pattern_code
  BEFORE INSERT
  ON morph_pattern
  FOR EACH ROW
EXECUTE FUNCTION assign_morph_pattern_code();

CREATE OR REPLACE FUNCTION keep_morph_pattern_code
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'morph_pattern.code is a stable identifier and cannot change (pattern %: % to %)',
      OLD.id, OLD.code, NEW.code
      USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_keep_morph_pattern_code
  BEFORE UPDATE
  ON morph_pattern
  FOR EACH ROW
EXECUTE FUNCTION keep_morph_pattern_code();

CREATE OR REPLACE FUNCTION fill_morph_pattern_resolution
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
DECLARE
  v_pattern RECORD;
BEGIN
  SELECT form_number, perfect_vowel, imperfect_vowel, is_lexical, code
  INTO v_pattern
  FROM morph_pattern
  WHERE id = NEW.morph_pattern_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'morph_pattern % does not exist', NEW.morph_pattern_id
      USING ERRCODE = '23503';
  END IF;

  IF v_pattern.is_lexical THEN
    RAISE EXCEPTION 'pattern % is lexical: it is reached through lexical_pattern_override, never by root shape',
      v_pattern.code
      USING ERRCODE = '23514';
  END IF;

  NEW.form_number := v_pattern.form_number;
  NEW.perfect_vowel := v_pattern.perfect_vowel;
  NEW.imperfect_vowel := v_pattern.imperfect_vowel;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_fill_morph_pattern_resolution
  BEFORE INSERT OR UPDATE
  ON morph_pattern_resolution
  FOR EACH ROW
EXECUTE FUNCTION fill_morph_pattern_resolution();

INSERT INTO morph_pattern_resolution (morph_pattern_id, radical1_kind, radical2_kind, radical3_kind, is_geminate)
SELECT DISTINCT ON (form_number, perfect_vowel, imperfect_vowel, radical1_kind, radical2_kind, radical3_kind,
                    is_geminate) id,
                                 radical1_kind,
                                 radical2_kind,
                                 radical3_kind,
                                 is_geminate
FROM morph_pattern
WHERE NOT is_lexical
ORDER BY form_number, perfect_vowel, imperfect_vowel, radical1_kind, radical2_kind, radical3_kind, is_geminate, id
ON CONFLICT ON CONSTRAINT unique_morph_pattern_resolution_key DO NOTHING;

CREATE OR REPLACE FUNCTION sync_morph_pattern_resolution
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
DECLARE
  shape_changed BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_lexical THEN
      DELETE FROM morph_pattern_resolution WHERE morph_pattern_id = NEW.id;
      RETURN NULL;
    END IF;

    shape_changed := (NEW.radical1_kind, NEW.radical2_kind, NEW.radical3_kind, NEW.is_geminate)
      IS DISTINCT FROM (OLD.radical1_kind, OLD.radical2_kind, OLD.radical3_kind, OLD.is_geminate);

    IF shape_changed AND NOT OLD.is_lexical THEN
      DELETE FROM morph_pattern_resolution r
      WHERE r.morph_pattern_id = NEW.id
        AND (r.radical1_kind, r.radical2_kind, r.radical3_kind, r.is_geminate)
        = (OLD.radical1_kind, OLD.radical2_kind, OLD.radical3_kind, OLD.is_geminate);
    END IF;

    IF (NEW.form_number, NEW.perfect_vowel, NEW.imperfect_vowel)
      IS DISTINCT FROM (OLD.form_number, OLD.perfect_vowel, OLD.imperfect_vowel) THEN
      UPDATE morph_pattern_resolution
      SET form_number     = NEW.form_number,
          perfect_vowel   = NEW.perfect_vowel,
          imperfect_vowel = NEW.imperfect_vowel
      WHERE morph_pattern_id = NEW.id;
    END IF;

    IF NOT (shape_changed OR OLD.is_lexical) THEN
      RETURN NULL;
    END IF;
  ELSIF NEW.is_lexical THEN
    RETURN NULL;
  END IF;

  INSERT INTO morph_pattern_resolution (morph_pattern_id, radical1_kind, radical2_kind, radical3_kind, is_geminate)
  SELECT NEW.id, NEW.radical1_kind, NEW.radical2_kind, NEW.radical3_kind, NEW.is_geminate
  WHERE NOT EXISTS (SELECT 1
                    FROM morph_pattern_resolution r
                    WHERE r.morph_pattern_id = NEW.id
                      AND (r.radical1_kind, r.radical2_kind, r.radical3_kind, r.is_geminate)
                      = (NEW.radical1_kind, NEW.radical2_kind, NEW.radical3_kind, NEW.is_geminate));
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_morph_pattern_resolution
  AFTER INSERT OR UPDATE OF form_number, perfect_vowel, imperfect_vowel, radical1_kind, radical2_kind, radical3_kind,
    is_geminate, is_lexical
  ON morph_pattern
  FOR EACH ROW
EXECUTE FUNCTION sync_morph_pattern_resolution();

CREATE OR REPLACE FUNCTION add_morph_pattern_resolution
(
  p_code TEXT,
  p_example_root TEXT
) RETURNS INTEGER
  LANGUAGE plpgsql AS
$$
DECLARE
  v_pattern_id INTEGER := morph_pattern_id_for_code(p_code);
  v_shape      root_classification := classify_root(p_example_root);
  v_existing   RECORD;
  v_id         INTEGER;
BEGIN
  SELECT r.id, r.morph_pattern_id, holder.code
  INTO v_existing
  FROM morph_pattern target
  JOIN morph_pattern_resolution r
    ON r.form_number = target.form_number
      AND r.perfect_vowel IS NOT DISTINCT FROM target.perfect_vowel
      AND r.imperfect_vowel IS NOT DISTINCT FROM target.imperfect_vowel
  JOIN morph_pattern holder ON holder.id = r.morph_pattern_id
  WHERE target.id = v_pattern_id
    AND r.radical1_kind = v_shape.radical1
    AND r.radical2_kind = v_shape.radical2
    AND r.radical3_kind = v_shape.radical3
    AND r.is_geminate = v_shape.is_geminate;

  IF FOUND THEN
    IF v_existing.morph_pattern_id = v_pattern_id THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'the root shape of % already resolves to pattern % for this verb form, not to %',
      p_example_root, v_existing.code, p_code
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO morph_pattern_resolution (morph_pattern_id, radical1_kind, radical2_kind, radical3_kind, is_geminate)
  VALUES (v_pattern_id, v_shape.radical1, v_shape.radical2, v_shape.radical3, v_shape.is_geminate)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
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
