CREATE OR REPLACE FUNCTION normalize_morph_pattern_alternative_root
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
BEGIN
  NEW.root := NULLIF(strip_root_noise(NEW.root), '');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_normalize_morph_pattern_alternative_root
  BEFORE INSERT OR UPDATE OF root
  ON morph_pattern_alternative
  FOR EACH ROW
  WHEN (NEW.root IS NOT NULL)
EXECUTE FUNCTION normalize_morph_pattern_alternative_root();

CREATE OR REPLACE FUNCTION entry_alternative_forms
(
  p_entry_ids INTEGER[]
) RETURNS TABLE
          (
            lexical_entry_id INTEGER,
            voice            voice_type,
            mood             affix_mood,
            person           person_type,
            ordinal          SMALLINT,
            form             TEXT
          )
  LANGUAGE plpgsql
  STABLE
  ROWS 20
  SET plan_cache_mode = force_generic_plan
AS
$$
BEGIN
  RETURN QUERY
SELECT picked.entry_id, picked.voice, picked.mood, picked.person, picked.ordinal, picked.form
FROM (SELECT DISTINCT ON (e.id, a.voice, a.mood, a.person, evaluated.form) e.id AS entry_id,
                                                                            a.voice,
                                                                            a.mood,
                                                                            a.person,
                                                                            a.ordinal,
                                                                            evaluated.form
      FROM UNNEST(p_entry_ids) AS wanted (id)
             JOIN lexical_entry e ON e.id = wanted.id
             JOIN morph_pattern p ON p.id = e.morph_pattern_id
             CROSS JOIN LATERAL (SELECT strip_root_noise(e.root) AS root) cleaned
             JOIN morph_pattern_alternative a
                  ON a.morph_pattern_id = p.id
                    AND (a.root IS NULL OR canonical_hamza_root(a.root) = canonical_hamza_root(cleaned.root))
             CROSS JOIN LATERAL (SELECT CASE
                                          WHEN a.verbatim THEN placeholders.text
                                          ELSE normalize_arabic_orthography(placeholders.text)
                                          END AS form
                                 FROM (SELECT replace_root_placeholders(
                                                CASE
                                                  WHEN p.form_number = 8
                                                    THEN assimilate_form_viii_infix(TO_JSONB(a.template),
                                                                                    SUBSTRING(cleaned.root, 1, 1)) #>> '{}'
                                                  ELSE a.template
                                                  END,
                                                SUBSTRING(cleaned.root, 1, 1),
                                                SUBSTRING(cleaned.root, 2, 1),
                                                SUBSTRING(cleaned.root, 3, 1)
                                              ) AS text) placeholders) evaluated
      WHERE CHAR_LENGTH(cleaned.root) = 3
        AND NOT EXISTS (SELECT 1
                        FROM conjugation c
                        WHERE c.lexical_entry_id = e.id
                          AND c.voice = a.voice
                          AND c.mood = a.mood
                          AND c.person = a.person
                          AND c.form = evaluated.form)
      ORDER BY e.id, a.voice, a.mood, a.person, evaluated.form, a.ordinal) picked
ORDER BY picked.entry_id, picked.voice, picked.mood, picked.person, picked.ordinal;
END;
$$;
