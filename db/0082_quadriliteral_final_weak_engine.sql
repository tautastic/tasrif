CREATE OR REPLACE FUNCTION classify_quadriliteral_radical4
(
  root_text TEXT
) RETURNS radical_kind
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT CASE
         WHEN last_kind = 'hamza' THEN 'sound'::radical_kind
         ELSE last_kind
         END
FROM (SELECT classify_root_radical(SUBSTRING(require_radical_count(root_text, 4) FROM 4 FOR 1)) AS last_kind) AS fourth
$$;

CREATE OR REPLACE FUNCTION sync_morph_pattern_resolution()
  RETURNS trigger
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

    shape_changed := (NEW.radical1_kind, NEW.radical2_kind, NEW.radical3_kind, NEW.radical4_kind, NEW.is_geminate)
      IS DISTINCT FROM (OLD.radical1_kind, OLD.radical2_kind, OLD.radical3_kind, OLD.radical4_kind, OLD.is_geminate);

    IF shape_changed AND NOT OLD.is_lexical THEN
      DELETE FROM morph_pattern_resolution r
      WHERE r.morph_pattern_id = NEW.id
        AND (r.radical1_kind, r.radical2_kind, r.radical3_kind, r.radical4_kind, r.is_geminate)
        = (OLD.radical1_kind, OLD.radical2_kind, OLD.radical3_kind, OLD.radical4_kind, OLD.is_geminate);
    END IF;

    IF (NEW.form_number, NEW.radical_count, NEW.perfect_vowel, NEW.imperfect_vowel)
      IS DISTINCT FROM (OLD.form_number, OLD.radical_count, OLD.perfect_vowel, OLD.imperfect_vowel) THEN
      UPDATE morph_pattern_resolution
      SET form_number     = NEW.form_number,
          radical_count   = NEW.radical_count,
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

  INSERT INTO morph_pattern_resolution (morph_pattern_id, radical_count, radical1_kind, radical2_kind, radical3_kind,
                                        radical4_kind, is_geminate)
  SELECT NEW.id, NEW.radical_count, NEW.radical1_kind, NEW.radical2_kind, NEW.radical3_kind, NEW.radical4_kind,
         NEW.is_geminate
  WHERE NOT EXISTS (SELECT 1
                    FROM morph_pattern_resolution r
                    WHERE r.morph_pattern_id = NEW.id
                      AND (r.radical1_kind, r.radical2_kind, r.radical3_kind, r.radical4_kind, r.is_geminate)
                      = (NEW.radical1_kind, NEW.radical2_kind, NEW.radical3_kind, NEW.radical4_kind, NEW.is_geminate));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_morph_pattern_resolution ON morph_pattern;

CREATE TRIGGER trg_sync_morph_pattern_resolution
  AFTER INSERT OR UPDATE OF form_number, radical_count, perfect_vowel, imperfect_vowel, radical1_kind, radical2_kind,
    radical3_kind, radical4_kind, is_geminate, is_lexical
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
  v_radicals   INTEGER := (SELECT radical_count FROM morph_pattern WHERE id = v_pattern_id);
  v_shape      root_classification;
  v_radical4   radical_kind := 'sound';
  v_existing   RECORD;
  v_id         INTEGER;
BEGIN
  IF v_radicals = 4 THEN
    v_radical4 := classify_quadriliteral_radical4(p_example_root);
    v_shape := ROW ('sound', 'sound', 'sound', FALSE)::root_classification;
  ELSE
    v_shape := classify_root(p_example_root);
  END IF;

  SELECT r.id, r.morph_pattern_id, holder.code
  INTO v_existing
  FROM morph_pattern target
  JOIN morph_pattern_resolution r
    ON r.form_number = target.form_number
      AND r.radical_count = target.radical_count
      AND r.perfect_vowel IS NOT DISTINCT FROM target.perfect_vowel
      AND r.imperfect_vowel IS NOT DISTINCT FROM target.imperfect_vowel
  JOIN morph_pattern holder ON holder.id = r.morph_pattern_id
  WHERE target.id = v_pattern_id
    AND r.radical1_kind = v_shape.radical1
    AND r.radical2_kind = v_shape.radical2
    AND r.radical3_kind = v_shape.radical3
    AND r.radical4_kind = v_radical4
    AND r.is_geminate = v_shape.is_geminate;

  IF FOUND THEN
    IF v_existing.morph_pattern_id = v_pattern_id THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'the root shape of % already resolves to pattern % for this verb form, not to %',
      p_example_root, v_existing.code, p_code
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO morph_pattern_resolution (morph_pattern_id, radical1_kind, radical2_kind, radical3_kind, radical4_kind,
                                        is_geminate)
  VALUES (v_pattern_id, v_shape.radical1, v_shape.radical2, v_shape.radical3, v_radical4, v_shape.is_geminate)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_morph_pattern_id
(
  root_text TEXT,
  target_form_number INTEGER,
  target_perfect_vowel short_vowel DEFAULT NULL,
  target_imperfect_vowel short_vowel DEFAULT NULL,
  target_radical_count INTEGER DEFAULT 3
) RETURNS INTEGER
  LANGUAGE plpgsql
  STABLE AS
$$
DECLARE
  classification root_classification;
  radical4       radical_kind := 'sound';
  resolved_id    INTEGER;
BEGIN
  IF target_form_number = 1 AND (target_perfect_vowel IS NULL OR target_imperfect_vowel IS NULL) THEN
    RAISE EXCEPTION 'form I requires both a perfect and an imperfect vowel'
      USING ERRCODE = '22023';
  END IF;

  IF target_form_number != 1 AND (target_perfect_vowel IS NOT NULL OR target_imperfect_vowel IS NOT NULL) THEN
    RAISE EXCEPTION 'perfect/imperfect vowels only apply to form I, got form %', target_form_number
      USING ERRCODE = '22023';
  END IF;

  IF target_radical_count NOT IN (3, 4) THEN
    RAISE EXCEPTION 'a verb root has 3 or 4 radicals, got %', target_radical_count
      USING ERRCODE = '22023';
  END IF;

  SELECT o.morph_pattern_id
  INTO resolved_id
  FROM lexical_pattern_override o
  JOIN morph_pattern mp ON mp.id = o.morph_pattern_id
  WHERE canonical_hamza_root(o.root) = canonical_hamza_root(strip_root_noise(root_text))
    AND o.form_number = target_form_number
    AND o.perfect_vowel IS NOT DISTINCT FROM target_perfect_vowel
    AND o.imperfect_vowel IS NOT DISTINCT FROM target_imperfect_vowel
    AND mp.radical_count = target_radical_count
    AND o.variant IS NULL
  ORDER BY o.id
  LIMIT 1;

  IF resolved_id IS NOT NULL THEN
    RETURN resolved_id;
  END IF;

  IF target_radical_count = 4 THEN
    radical4 := classify_quadriliteral_radical4(root_text);
    classification := ROW ('sound', 'sound', 'sound', FALSE)::root_classification;
  ELSE
    classification := classify_root(root_text);
  END IF;

  SELECT morph_pattern_id
  INTO resolved_id
  FROM morph_pattern_resolution
  WHERE form_number = target_form_number
    AND radical_count = target_radical_count
    AND perfect_vowel IS NOT DISTINCT FROM target_perfect_vowel
    AND imperfect_vowel IS NOT DISTINCT FROM target_imperfect_vowel
    AND radical1_kind = classification.radical1
    AND radical2_kind = classification.radical2
    AND radical3_kind = classification.radical3
    AND radical4_kind = radical4
    AND is_geminate = classification.is_geminate;

  RETURN resolved_id;
END;
$$;
