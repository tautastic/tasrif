CREATE OR REPLACE FUNCTION strip_root_noise
(
  root_text TEXT
) RETURNS TEXT
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT TRANSLATE(
         REGEXP_REPLACE(
           NORMALIZE(BTRIM(root_text), NFC),
           '[\u0640\u064B-\u065F\u0670\u06D6-\u06ED\u00A0\u200C-\u200F\s-]',
           '',
           'g'
         ),
         U&'\0649',
         U&'\064A'
       )
$$;

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

  IF POSITION(U&'\0627' IN cleaned) > 0 THEN
    RAISE EXCEPTION 'root ''%'' contains alef (ا), which is never a radical: write a weak radical as و or ي',
      root_text
      USING ERRCODE = '22023';
  END IF;

  RETURN cleaned;
END;
$$;

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
SET root = strip_root_noise(root)
WHERE root IS NOT NULL
  AND root <> strip_root_noise(root)
  AND (morph_pattern_id IS NULL OR CHAR_LENGTH(strip_root_noise(root)) = 3);
