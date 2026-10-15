CREATE OR REPLACE FUNCTION enforce_lexical_pattern_override_variant
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
DECLARE
  v_pattern morph_pattern%ROWTYPE;
BEGIN
  SELECT * INTO v_pattern FROM morph_pattern WHERE id = NEW.morph_pattern_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NOT v_pattern.is_lexical THEN
    RAISE EXCEPTION 'pattern % is not lexical: a variant of a root, form and vowels must be a lexical pattern',
      v_pattern.code
      USING ERRCODE = '23514';
  END IF;

  IF v_pattern.form_number <> NEW.form_number
    OR v_pattern.perfect_vowel IS DISTINCT FROM NEW.perfect_vowel
    OR v_pattern.imperfect_vowel IS DISTINCT FROM NEW.imperfect_vowel THEN
    RAISE EXCEPTION 'pattern % does not belong to the form and vowels of this variant', v_pattern.code
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_enforce_lexical_pattern_override_variant
  BEFORE INSERT OR UPDATE OF variant, morph_pattern_id, form_number, perfect_vowel, imperfect_vowel
  ON lexical_pattern_override
  FOR EACH ROW
  WHEN (NEW.variant IS NOT NULL)
EXECUTE FUNCTION enforce_lexical_pattern_override_variant();

CREATE OR REPLACE FUNCTION morph_pattern_variant_candidates
(
  root_text TEXT,
  target_form_number INTEGER,
  target_perfect_vowel short_vowel DEFAULT NULL,
  target_imperfect_vowel short_vowel DEFAULT NULL,
  target_radical_count INTEGER DEFAULT 3
) RETURNS TABLE
          (
            morph_pattern_id INTEGER,
            variant          TEXT,
            note             TEXT,
            is_default       BOOLEAN
          )
  LANGUAGE plpgsql
  STABLE
  ROWS 3
AS
$$
DECLARE
  v_resolved INTEGER := resolve_morph_pattern_id(root_text, target_form_number, target_perfect_vowel,
                                                 target_imperfect_vowel, target_radical_count);
  v_root     TEXT    := canonical_hamza_root(strip_root_noise(root_text));
BEGIN
  RETURN QUERY
    SELECT ranked.morph_pattern_id, ranked.variant, ranked.note, ranked.is_default
    FROM (SELECT v_resolved AS morph_pattern_id, NULL::TEXT AS variant, NULL::TEXT AS note, TRUE AS is_default,
                 0 AS sort_group, 0 AS sort_id
          WHERE v_resolved IS NOT NULL
          UNION ALL
          SELECT chosen.morph_pattern_id, chosen.variant, chosen.note, FALSE, 1, chosen.id
          FROM (SELECT DISTINCT ON (o.morph_pattern_id) o.morph_pattern_id, o.variant, o.note, o.id
                FROM lexical_pattern_override o
                       JOIN morph_pattern p ON p.id = o.morph_pattern_id
                WHERE o.variant IS NOT NULL
                  AND canonical_hamza_root(o.root) = v_root
                  AND o.form_number = target_form_number
                  AND o.perfect_vowel IS NOT DISTINCT FROM target_perfect_vowel
                  AND o.imperfect_vowel IS NOT DISTINCT FROM target_imperfect_vowel
                  AND p.is_lexical
                  AND p.radical_count = target_radical_count
                  AND p.form_number = o.form_number
                  AND o.morph_pattern_id IS DISTINCT FROM v_resolved
                ORDER BY o.morph_pattern_id, o.id) chosen) ranked
    ORDER BY ranked.sort_group, ranked.variant, ranked.sort_id;
END;
$$;

CREATE OR REPLACE FUNCTION morph_pattern_variants
(
  root_text TEXT,
  target_form_number INTEGER,
  target_perfect_vowel short_vowel DEFAULT NULL,
  target_imperfect_vowel short_vowel DEFAULT NULL,
  target_radical_count INTEGER DEFAULT 3
) RETURNS TABLE
          (
            morph_pattern_id INTEGER,
            code             TEXT,
            description      TEXT,
            vocalic_template TEXT,
            variant          TEXT,
            note             TEXT,
            is_default       BOOLEAN,
            sample           TEXT
          )
  LANGUAGE sql
  STABLE
  ROWS 3
AS
$$
SELECT p.id,
       p.code,
       p.description,
       p.vocalic_template,
       c.variant,
       c.note,
       c.is_default,
       (SELECT generated.person_forms ->> 'third_person_masculine_singular'
        FROM generate_conjugation_rows(root_text, p.rules, p.form_number, '{}'::jsonb, p.no_affix) generated
        WHERE generated.mood = 'perfect'
        LIMIT 1)
FROM morph_pattern_variant_candidates(root_text, target_form_number, target_perfect_vowel, target_imperfect_vowel,
                                      target_radical_count)
       WITH ORDINALITY AS c (morph_pattern_id, variant, note, is_default, position)
       JOIN morph_pattern p ON p.id = c.morph_pattern_id
ORDER BY c.position
$$;

CREATE OR REPLACE FUNCTION morph_pattern_choice_allowed
(
  root_text TEXT,
  target_form_number INTEGER,
  target_perfect_vowel short_vowel,
  target_imperfect_vowel short_vowel,
  chosen_pattern_id INTEGER,
  target_radical_count INTEGER DEFAULT 3
) RETURNS BOOLEAN
  LANGUAGE sql
  STABLE AS
$$
SELECT EXISTS (SELECT 1
               FROM morph_pattern_variant_candidates(root_text, target_form_number, target_perfect_vowel,
                                                     target_imperfect_vowel, target_radical_count) c
               WHERE c.morph_pattern_id = chosen_pattern_id)
$$;
