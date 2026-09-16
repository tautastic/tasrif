CREATE OR REPLACE FUNCTION strip_root_noise
(
  root_text TEXT
) RETURNS TEXT
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REGEXP_REPLACE(
         BTRIM(root_text),
         '[\u0640\u064B-\u065F\u0670\u06D6-\u06ED\u00A0\u200C-\u200F\s-]',
         '',
         'g'
       )
$$;

CREATE OR REPLACE FUNCTION transliterate_arabic_root
(
  root_text TEXT
) RETURNS TEXT
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT NULLIF(
  TRANSLATE(
    strip_root_noise(root_text),
    'ابتثجحخدذرزسشصضطظعغفقكلمنهويءأإآؤئةى',
    'ʔbtṯjḥḵdḏrzsšṣḍṭẓʕḡfqklmnhwyʔʔʔʔʔʔhy'
  ),
  ''
)
$$;

CREATE OR REPLACE FUNCTION set_lexical_entry_latin_root
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
BEGIN
  NEW.latin_root := transliterate_arabic_root(NEW.root);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_set_lexical_entry_latin_root
  BEFORE INSERT OR UPDATE OF root
  ON lexical_entry
  FOR EACH ROW
EXECUTE FUNCTION set_lexical_entry_latin_root();
