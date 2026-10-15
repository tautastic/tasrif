CREATE OR REPLACE FUNCTION entry_slug
(
  input text
) RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE
  STRICT
  PARALLEL SAFE AS
$$
DECLARE
  result text;
BEGIN
  result := LOWER(NORMALIZE(input, NFKC));
  result := TRANSLATE(result, U&'\06CC\06A9\0671', U&'\064A\0643\0627');
  result := REGEXP_REPLACE(
              result,
              '[\u0640\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]',
              '',
              'g'
            );
  result := REGEXP_REPLACE(
              result,
              '[\u0009-\u000D\u0020\u005F\u0085\u00A0\u1680\u180E\u2000-\u200A\u2010-\u2015\u2028\u2029\u202F\u205F\u2212\u3000]+',
              '-',
              'g'
            );
  result := REGEXP_REPLACE(
              result,
              '[\u0001-\u0008\u000E-\u001F\u0021-\u002C\u002E-\u002F\u003A-\u0040\u005B-\u005E\u0060\u007B-\u00BF\u00D7\u00F7'
              '\u02B0-\u02FF\u0600-\u0605\u060C-\u060F\u061B-\u061F\u066A-\u066D\u06D4\u06DD\u06DE\u06E9'
              '\u200B-\u200F\u2016-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u206F\u20A0-\u20CF\u2190-\u2BFF'
              '\u2E00-\u2E7F\u3001-\u303F\uE000-\uF8FF\uFD3E\uFD3F\uFE00-\uFE0F\uFEFF\uFFF0-\uFFFF'
              '\U0001F000-\U0001FAFF\U000E0000-\U000E01EF]',
              '',
              'g'
            );
  result := BTRIM(REGEXP_REPLACE(result, '-+', '-', 'g'), '-');
  RETURN NORMALIZE(result, NFKC);
END;
$$;

CREATE OR REPLACE FUNCTION lexical_entry_slug
(
  p_id integer,
  p_text text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT COALESCE(NULLIF(entry_slug(p_text), ''), 'e-' || p_id::text)
$$;

CREATE OR REPLACE FUNCTION set_lexical_entry_slug() RETURNS trigger
  LANGUAGE plpgsql AS
$$
BEGIN
  NEW.slug := lexical_entry_slug(NEW.id, NEW.text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION maintain_entry_slug_redirect() RETURNS trigger
  LANGUAGE plpgsql AS
$$
BEGIN
  DELETE FROM entry_slug_redirect WHERE old_slug IN (NEW.slug, NEW.normalized_text);
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO entry_slug_redirect (old_slug, lexical_entry_id)
    SELECT retired.url_key, NEW.id
    FROM (SELECT OLD.slug AS url_key UNION SELECT OLD.normalized_text) retired
    WHERE retired.url_key <> ''
      AND retired.url_key NOT IN (NEW.slug, NEW.normalized_text)
      AND NOT EXISTS (
        SELECT 1
        FROM lexical_entry other
        WHERE other.id <> NEW.id AND (other.slug = retired.url_key OR other.normalized_text = retired.url_key)
      )
    ON CONFLICT (old_slug) DO UPDATE SET lexical_entry_id = EXCLUDED.lexical_entry_id, created_at = now();
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_entry_slug_redirect
(
  p_key text
) RETURNS text
  LANGUAGE sql
  STABLE AS
$$
SELECT candidate.slug
FROM (
  SELECT le.slug, 1 AS priority, le.id
  FROM entry_slug_redirect r
    JOIN lexical_entry le ON le.id = r.lexical_entry_id
  WHERE r.old_slug = p_key AND le.is_verified AND le.slug <> p_key
  UNION ALL
  SELECT le.slug, 2, le.id
  FROM lexical_entry le
  WHERE le.normalized_text = p_key AND le.is_verified AND le.slug <> p_key
  UNION ALL
  SELECT le.slug, 3, le.id
  FROM lexical_entry le
  WHERE le.slug = entry_slug(p_key) AND entry_slug(p_key) <> '' AND le.is_verified AND le.slug <> p_key
) candidate
WHERE NOT EXISTS (SELECT 1 FROM lexical_entry live WHERE live.slug = p_key AND live.is_verified)
ORDER BY candidate.priority, candidate.id
LIMIT 1
$$;

DROP TRIGGER IF EXISTS trg_set_lexical_entry_slug ON lexical_entry;
CREATE TRIGGER trg_set_lexical_entry_slug
  BEFORE INSERT OR UPDATE OF id, text, slug
  ON lexical_entry
  FOR EACH ROW
EXECUTE FUNCTION set_lexical_entry_slug();

UPDATE lexical_entry
SET slug = lexical_entry_slug(id, text)
WHERE slug IS NULL;

ALTER TABLE lexical_entry
  ALTER COLUMN slug SET NOT NULL;

DROP TRIGGER IF EXISTS trg_maintain_entry_slug_redirect_after_insert ON lexical_entry;
CREATE TRIGGER trg_maintain_entry_slug_redirect_after_insert
  AFTER INSERT
  ON lexical_entry
  FOR EACH ROW
EXECUTE FUNCTION maintain_entry_slug_redirect();

DROP TRIGGER IF EXISTS trg_maintain_entry_slug_redirect_after_update ON lexical_entry;
CREATE TRIGGER trg_maintain_entry_slug_redirect_after_update
  AFTER UPDATE
  ON lexical_entry
  FOR EACH ROW
  WHEN (OLD.slug IS DISTINCT FROM NEW.slug OR OLD.normalized_text IS DISTINCT FROM NEW.normalized_text)
EXECUTE FUNCTION maintain_entry_slug_redirect();
