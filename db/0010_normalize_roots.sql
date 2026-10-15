CREATE OR REPLACE FUNCTION require_triliteral_root
(
  root_text TEXT
) RETURNS TEXT
  LANGUAGE plpgsql
  IMMUTABLE AS
$$
DECLARE
  cleaned TEXT;
BEGIN
  cleaned := strip_root_noise(root_text);

  IF CHAR_LENGTH(cleaned) IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'root ''%'' must have exactly 3 radicals after normalization, found %',
      root_text, COALESCE(CHAR_LENGTH(cleaned), 0)
      USING ERRCODE = '22023';
  END IF;

  RETURN cleaned;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_lexical_entry_root
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
BEGIN
  NEW.root := NULLIF(strip_root_noise(NEW.root), '');

  IF NEW.morph_pattern_id IS NOT NULL AND NEW.root IS NOT NULL AND CHAR_LENGTH(NEW.root) <> 3 THEN
    RAISE EXCEPTION 'root ''%'' must have exactly 3 radicals when a morphological pattern is attached, found %',
      NEW.root, CHAR_LENGTH(NEW.root)
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_normalize_lexical_entry_root
  BEFORE INSERT OR UPDATE OF root, morph_pattern_id
  ON lexical_entry
  FOR EACH ROW
EXECUTE FUNCTION normalize_lexical_entry_root();

CREATE OR REPLACE FUNCTION normalize_lexical_pattern_override_root
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
BEGIN
  NEW.root := strip_root_noise(NEW.root);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_normalize_lexical_pattern_override_root
  BEFORE INSERT OR UPDATE OF root
  ON lexical_pattern_override
  FOR EACH ROW
EXECUTE FUNCTION normalize_lexical_pattern_override_root();

UPDATE lexical_pattern_override o
SET root = strip_root_noise(o.root)
WHERE o.root <> strip_root_noise(o.root)
  AND NOT EXISTS (SELECT 1
                  FROM lexical_pattern_override other
                  WHERE other.id <> o.id
                    AND other.root = strip_root_noise(o.root)
                    AND other.form_number = o.form_number
                    AND other.perfect_vowel IS NOT DISTINCT FROM o.perfect_vowel
                    AND other.imperfect_vowel IS NOT DISTINCT FROM o.imperfect_vowel);

UPDATE lexical_entry
SET root = NULLIF(strip_root_noise(root), '')
WHERE root IS DISTINCT FROM NULLIF(strip_root_noise(root), '')
  AND (morph_pattern_id IS NULL OR CHAR_LENGTH(NULLIF(strip_root_noise(root), '')) IS NULL
    OR CHAR_LENGTH(NULLIF(strip_root_noise(root), '')) = 3);
