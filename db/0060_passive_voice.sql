CREATE OR REPLACE FUNCTION passive_rules_as_active
(
  rules jsonb
) RETURNS jsonb
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT COALESCE(JSONB_OBJECT_AGG(SUBSTRING(rule.key FROM 9), rule.value), '{}'::jsonb)
FROM JSONB_EACH(rules) AS rule
WHERE rule.key IN ('passive_perfect', 'passive_imperfect_stem', 'passive_imperfect_indicative',
                   'passive_imperfect_subjunctive', 'passive_imperfect_jussive')
$$;

CREATE OR REPLACE FUNCTION has_passive_rules
(
  rules jsonb
) RETURNS boolean
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT JSONB_TYPEOF(rules) = 'object'
         AND rules ?| ARRAY ['passive_perfect', 'passive_imperfect_stem', 'passive_imperfect_indicative',
                             'passive_imperfect_subjunctive', 'passive_imperfect_jussive']
$$;

CREATE OR REPLACE FUNCTION prepared_passive_affix_rules
(
) RETURNS jsonb
  LANGUAGE sql
  STABLE AS
$$
SELECT prepared_affix_rules(2)
$$;

CREATE OR REPLACE FUNCTION passive_vowelless_ya_after_damma
(
  person_forms jsonb
) RETURNS jsonb
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT COALESCE(JSONB_OBJECT_AGG(form.key, REPLACE(form.value, U&'\064F\064A\0652', U&'\064F\0648')), '{}'::jsonb)
FROM JSONB_EACH_TEXT(person_forms) AS form
$$;

CREATE OR REPLACE FUNCTION generate_passive_rows_from_affixes
(
  root_text TEXT,
  rules jsonb,
  form_number INTEGER,
  overrides jsonb,
  p_no_affix boolean,
  p_affixes jsonb
)
  RETURNS TABLE
          (
            mood         affix_mood,
            person_forms jsonb
          )
  LANGUAGE plpgsql
  STABLE
  ROWS 4
AS
$$
BEGIN
  IF NOT has_passive_rules(rules) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT generated.mood, passive_vowelless_ya_after_damma(generated.person_forms)
    FROM generate_conjugation_rows_from_affixes(root_text, passive_rules_as_active(rules), form_number, overrides,
                                                p_no_affix, p_affixes) AS generated;
END;
$$;

CREATE OR REPLACE FUNCTION generate_passive_rows
(
  root_text TEXT,
  rules jsonb,
  form_number INTEGER,
  overrides jsonb DEFAULT '{}'::jsonb,
  p_no_affix boolean DEFAULT FALSE
)
  RETURNS TABLE
          (
            mood         affix_mood,
            person_forms jsonb
          )
  LANGUAGE plpgsql
  STABLE
  ROWS 4
AS
$$
BEGIN
  RETURN QUERY SELECT generated.mood, generated.person_forms
               FROM generate_passive_rows_from_affixes(root_text, rules, form_number, overrides, p_no_affix,
                                                       prepared_passive_affix_rules()) AS generated;
END;
$$;

CREATE OR REPLACE FUNCTION regenerate_passive_conjugations
(
  p_entry_ids INTEGER[]
) RETURNS void
  LANGUAGE plpgsql
  SET plan_cache_mode = force_generic_plan AS
$$
BEGIN
  WITH batch_entries AS (
    SELECT le.id, le.root, le.morphology_overrides, le.morph_pattern_id
    FROM lexical_entry le
    WHERE le.id = ANY (p_entry_ids)
  ), patterns AS MATERIALIZED (
    SELECT mp.id, mp.rules, mp.form_number, mp.no_affix
    FROM morph_pattern mp
    WHERE mp.id IN (SELECT e.morph_pattern_id FROM batch_entries e)
      AND has_passive_rules(mp.rules)
  ), targets AS (
    SELECT e.id,
           strip_root_noise(e.root) AS root,
           COALESCE(e.morphology_overrides, '{}'::jsonb) AS overrides,
           p.rules,
           p.form_number,
           p.no_affix
    FROM batch_entries e
    JOIN patterns p ON p.id = e.morph_pattern_id
    WHERE CHAR_LENGTH(strip_root_noise(e.root)) = 3
      AND NOT COALESCE((e.morphology_overrides ->> 'no_passive')::boolean, FALSE)
  ), affixes AS MATERIALIZED (
    SELECT prepared_passive_affix_rules() AS prepared
  ), generated AS (
    SELECT t.id AS entry_id,
           pr.mood,
           kv.key::person_type AS person,
           kv.value AS form,
           pr.mood_order,
           kv.person_order
    FROM targets t
    CROSS JOIN affixes a
    CROSS JOIN LATERAL generate_passive_rows_from_affixes(t.root, t.rules, t.form_number, t.overrides, t.no_affix,
                                                          a.prepared)
      WITH ORDINALITY AS pr(mood, person_forms, mood_order)
    CROSS JOIN LATERAL JSONB_EACH_TEXT(pr.person_forms) WITH ORDINALITY AS kv(key, value, person_order)
    WHERE kv.value IS NOT NULL
      AND kv.value <> ''
  ), existing AS (
    SELECT c.id, c.lexical_entry_id, c.mood, c.person, c.form
    FROM conjugation c
    WHERE c.lexical_entry_id = ANY (p_entry_ids)
      AND c.voice = 'passive'
  ), matched AS (
    SELECT g.entry_id, g.mood, g.person, g.form, g.mood_order, g.person_order,
           e.id AS existing_id, e.form AS existing_form
    FROM generated g
    LEFT JOIN existing e
      ON e.lexical_entry_id = g.entry_id
        AND e.mood = g.mood
        AND e.person = g.person
  ), updated AS (
    UPDATE conjugation c
    SET form = m.form
    FROM matched m
    WHERE c.id = m.existing_id
      AND m.existing_form IS DISTINCT FROM m.form
  ), inserted AS (
    INSERT INTO conjugation (lexical_entry_id, voice, mood, person, form)
      SELECT m.entry_id, 'passive', m.mood, m.person, m.form
      FROM matched m
      WHERE m.existing_id IS NULL
      ORDER BY m.entry_id, m.mood_order, m.person_order
      ON CONFLICT ON CONSTRAINT unique_conjugation_entry_voice_mood_person
        DO UPDATE SET form = EXCLUDED.form
        WHERE conjugation.form IS DISTINCT FROM EXCLUDED.form
  )
  DELETE FROM conjugation c
  USING existing e
  WHERE c.id = e.id
    AND NOT EXISTS (SELECT 1
                    FROM matched m
                    WHERE m.existing_id = e.id);
END;
$$;

CREATE OR REPLACE FUNCTION regenerate_derived_stems_for_entry
(
  p_entry_id INTEGER
) RETURNS void
  LANGUAGE plpgsql AS
$$
DECLARE
  v_root TEXT;
  v_morph_pattern_id INTEGER;
  v_morphology_overrides jsonb;
  pattern_rules jsonb;
  v_form_number INTEGER;
  v_no_affix boolean;
  v_no_passive BOOLEAN;
  v_masdar TEXT;
  v_active_participle TEXT;
  v_passive_participle TEXT;
BEGIN
  SELECT strip_root_noise(root), morph_pattern_id, morphology_overrides
  INTO v_root, v_morph_pattern_id, v_morphology_overrides
  FROM lexical_entry
  WHERE id = p_entry_id;

  IF v_morph_pattern_id IS NOT NULL AND CHAR_LENGTH(v_root) = 3 THEN
    SELECT rules, form_number, no_affix
    INTO pattern_rules, v_form_number, v_no_affix
    FROM morph_pattern
    WHERE id = v_morph_pattern_id;
  END IF;

  IF JSONB_TYPEOF(pattern_rules) = 'object' THEN
    v_no_passive := COALESCE((v_morphology_overrides ->> 'no_passive')::boolean, FALSE);
    SELECT vn.masdar, vn.active_participle, vn.passive_participle
    INTO v_masdar, v_active_participle, v_passive_participle
    FROM generate_verbal_nouns(v_root, pattern_rules, v_form_number,
                               COALESCE(v_morphology_overrides, '{}'::jsonb), v_no_passive) AS vn;

    WITH generated AS (
      SELECT cr.mood, kv.key::person_type AS person, kv.value AS form
      FROM generate_conjugation_rows(v_root, pattern_rules, v_form_number,
                                     COALESCE(v_morphology_overrides, '{}'::jsonb),
                                     v_no_affix) AS cr,
           LATERAL jsonb_each_text(cr.person_forms) AS kv(key, value)
      WHERE kv.value IS NOT NULL AND kv.value <> ''
    ), upserted AS (
      INSERT INTO conjugation (lexical_entry_id, voice, mood, person, form)
        SELECT p_entry_id, 'active', g.mood, g.person, g.form
        FROM generated g
        ON CONFLICT ON CONSTRAINT unique_conjugation_entry_voice_mood_person
          DO UPDATE SET form = EXCLUDED.form
          WHERE conjugation.form IS DISTINCT FROM EXCLUDED.form
    )
    DELETE FROM conjugation c
    WHERE c.lexical_entry_id = p_entry_id
      AND c.voice = 'active'
      AND NOT EXISTS (SELECT 1 FROM generated g WHERE g.mood = c.mood AND g.person = c.person);

    PERFORM regenerate_passive_conjugations(ARRAY [p_entry_id]);
  ELSE
    DELETE FROM conjugation WHERE lexical_entry_id = p_entry_id;
  END IF;

  UPDATE lexical_entry le
  SET masdar             = v_masdar,
      active_participle  = v_active_participle,
      passive_participle = v_passive_participle,
      search_vector      = build_search_vector(le.id, le.language, le.text, le.normalized_text, v_masdar,
                                               v_active_participle, v_passive_participle)
  WHERE le.id = p_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION regenerate_derived_stems
(
  p_entry_ids INTEGER[],
  p_conjugations BOOLEAN DEFAULT TRUE
) RETURNS void
  LANGUAGE plpgsql
  SET plan_cache_mode = force_generic_plan AS
$$
DECLARE
  batch_size CONSTANT INTEGER := 500;
  batch_start INTEGER;
  batch INTEGER[];
BEGIN
  FOR batch_start IN 1..COALESCE(CARDINALITY(p_entry_ids), 0) BY batch_size
    LOOP
      batch := p_entry_ids[batch_start:batch_start + batch_size - 1];

      IF p_conjugations THEN
        WITH batch_entries AS (
          SELECT le.id, le.root, le.morphology_overrides, le.morph_pattern_id
          FROM lexical_entry le
          WHERE le.id = ANY (batch)
        ), patterns AS MATERIALIZED (
          SELECT mp.id, mp.rules, mp.form_number, mp.no_affix
          FROM morph_pattern mp
          WHERE mp.id IN (SELECT e.morph_pattern_id FROM batch_entries e)
            AND JSONB_TYPEOF(mp.rules) = 'object'
        ), targets AS (
          SELECT e.id,
                 strip_root_noise(e.root) AS root,
                 COALESCE(e.morphology_overrides, '{}'::jsonb) AS overrides,
                 p.rules,
                 p.form_number,
                 p.no_affix
          FROM batch_entries e
          JOIN patterns p ON p.id = e.morph_pattern_id
          WHERE CHAR_LENGTH(strip_root_noise(e.root)) = 3
        ), affixes AS (
          SELECT forms.form_number, prepared_affix_rules(forms.form_number) AS prepared
          FROM (SELECT DISTINCT form_number FROM targets) AS forms
        ), generated AS (
          SELECT t.id AS entry_id,
                 cr.mood,
                 kv.key::person_type AS person,
                 kv.value AS form,
                 cr.mood_order,
                 kv.person_order
          FROM targets t
          JOIN affixes a ON a.form_number = t.form_number
          CROSS JOIN LATERAL generate_conjugation_rows_from_affixes(t.root, t.rules, t.form_number, t.overrides,
                                                                    t.no_affix, a.prepared)
            WITH ORDINALITY AS cr(mood, person_forms, mood_order)
          CROSS JOIN LATERAL JSONB_EACH_TEXT(cr.person_forms) WITH ORDINALITY AS kv(key, value, person_order)
          WHERE kv.value IS NOT NULL
            AND kv.value <> ''
        ), existing AS (
          SELECT c.id, c.lexical_entry_id, c.voice, c.mood, c.person, c.form
          FROM conjugation c
          WHERE c.lexical_entry_id = ANY (batch)
            AND c.voice = 'active'
        ), matched AS (
          SELECT g.entry_id, g.mood, g.person, g.form, g.mood_order, g.person_order,
                 e.id AS existing_id, e.form AS existing_form
          FROM generated g
          LEFT JOIN existing e
            ON e.lexical_entry_id = g.entry_id
              AND e.voice = 'active'
              AND e.mood = g.mood
              AND e.person = g.person
        ), updated AS (
          UPDATE conjugation c
          SET form = m.form
          FROM matched m
          WHERE c.id = m.existing_id
            AND m.existing_form IS DISTINCT FROM m.form
        ), inserted AS (
          INSERT INTO conjugation (lexical_entry_id, voice, mood, person, form)
            SELECT m.entry_id, 'active', m.mood, m.person, m.form
            FROM matched m
            WHERE m.existing_id IS NULL
            ORDER BY m.entry_id, m.mood_order, m.person_order
            ON CONFLICT ON CONSTRAINT unique_conjugation_entry_voice_mood_person
              DO UPDATE SET form = EXCLUDED.form
              WHERE conjugation.form IS DISTINCT FROM EXCLUDED.form
        )
        DELETE FROM conjugation c
        USING existing e
        WHERE c.id = e.id
          AND NOT EXISTS (SELECT 1
                          FROM matched m
                          WHERE m.existing_id = e.id);

        PERFORM regenerate_passive_conjugations(batch);
      END IF;

      WITH batch_entries AS (
        SELECT le.id, le.root, le.morphology_overrides, le.morph_pattern_id, le.language, le.text, le.normalized_text
        FROM lexical_entry le
        WHERE le.id = ANY (batch)
      ), patterns AS MATERIALIZED (
        SELECT mp.id, mp.rules, mp.form_number
        FROM morph_pattern mp
        WHERE mp.id IN (SELECT e.morph_pattern_id FROM batch_entries e)
          AND JSONB_TYPEOF(mp.rules) = 'object'
      ), targets AS (
        SELECT e.id,
               strip_root_noise(e.root) AS root,
               COALESCE(e.morphology_overrides, '{}'::jsonb) AS overrides,
               p.rules,
               p.form_number
        FROM batch_entries e
        JOIN patterns p ON p.id = e.morph_pattern_id
        WHERE CHAR_LENGTH(strip_root_noise(e.root)) = 3
      ), nouns AS (
        SELECT t.id, vn.masdar, vn.active_participle, vn.passive_participle
        FROM targets t
        CROSS JOIN LATERAL generate_verbal_nouns(t.root, t.rules, t.form_number, t.overrides,
                                                 COALESCE((t.overrides ->> 'no_passive')::boolean, FALSE)) AS vn
        UNION ALL
        SELECT e.id, NULL, NULL, NULL
        FROM batch_entries e
        LEFT JOIN targets t ON t.id = e.id
        WHERE t.id IS NULL
      ), stems AS (
        SELECT n.id, n.masdar, n.active_participle, n.passive_participle,
               build_search_vector(e.id, e.language, e.text, e.normalized_text, n.masdar,
                                   n.active_participle, n.passive_participle) AS search_vector
        FROM nouns n
        JOIN batch_entries e ON e.id = n.id
      )
      UPDATE lexical_entry le
      SET masdar             = s.masdar,
          active_participle  = s.active_participle,
          passive_participle = s.passive_participle,
          search_vector      = s.search_vector
      FROM stems s
      WHERE le.id = s.id
        AND le.id = ANY (batch)
        AND (le.masdar, le.active_participle, le.passive_participle, le.search_vector)
          IS DISTINCT FROM (s.masdar, s.active_participle, s.passive_participle, s.search_vector);
    END LOOP;
END;
$$;
