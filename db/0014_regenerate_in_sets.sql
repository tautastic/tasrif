CREATE OR REPLACE FUNCTION normalize_arabic_orthography
(
  input text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT CASE
         WHEN input ~ '[\u0621-\u0626]' THEN
           normalize_arabic_long_vowels(
             normalize_arabic_hamza_assimilation(
               normalize_arabic_hamza_seating_after_alif(
                 normalize_arabic_hamza_seating_alif(
                   normalize_arabic_hamza_seating_waw_yeh(
                     normalize_arabic_hamza_seating_bare(
                       normalize_arabic_initial_hamza(
                         normalize_arabic_gemination(
                           normalize_arabic_alef_maqsura(
                             normalize_arabic_remove_tatweel(input)
                           )
                         )
                       )
                     )
                   )
                 )
               )
             )
           )
         ELSE
           normalize_arabic_long_vowels(
             normalize_arabic_gemination(
               normalize_arabic_alef_maqsura(
                 normalize_arabic_remove_tatweel(input)
               )
             )
           )
         END
$$;

CREATE OR REPLACE FUNCTION prepared_affix_rules
(
  p_form_number INTEGER
) RETURNS jsonb
  LANGUAGE plpgsql
  STABLE AS
$$
BEGIN
  RETURN (SELECT COALESCE(JSONB_OBJECT_AGG(grouped.mood, grouped.persons), '{}'::jsonb)
          FROM (SELECT rule.mood::text AS mood,
                       JSONB_OBJECT_AGG(rule.person::text, JSONB_BUILD_ARRAY(rule.prefix, rule.suffix)) AS persons
                FROM affix_rules rule
                WHERE (rule.mood IN ('perfect', 'imperative') AND rule.form = 0)
                   OR (rule.mood IN ('imperfect_indicative', 'imperfect_subjunctive', 'imperfect_jussive')
                     AND rule.form = p_form_number)
                GROUP BY rule.mood) AS grouped);
END;
$$;

CREATE OR REPLACE FUNCTION build_person_forms_from_affixes
(
  p_template_value jsonb,
  p_affixes jsonb,
  p_use_affix BOOLEAN,
  p_c1 TEXT,
  p_c2 TEXT,
  p_c3 TEXT
) RETURNS jsonb
  LANGUAGE plpgsql
  STABLE AS
$$
DECLARE
  v_person_forms jsonb := '{}'::jsonb;
  v_person TEXT;
  v_parts jsonb;
  v_stem_template TEXT;
  v_stem_text TEXT;
BEGIN
  IF p_use_affix THEN
    FOR v_person, v_parts IN SELECT affix.key, affix.value FROM JSONB_EACH(p_affixes) AS affix
      LOOP
        IF JSONB_TYPEOF(p_template_value) = 'object' THEN
          v_stem_template := p_template_value ->> v_person;
          IF v_stem_template IS NULL THEN CONTINUE; END IF;
          v_stem_text := replace_root_placeholders(v_stem_template, p_c1, p_c2, p_c3);
        ELSE
          v_stem_text := replace_root_placeholders(p_template_value #>> '{}', p_c1, p_c2, p_c3);
        END IF;
        v_stem_text := COALESCE(v_parts ->> 0, '') || v_stem_text || COALESCE(v_parts ->> 1, '');
        v_stem_text := normalize_arabic_orthography(v_stem_text);
        v_person_forms := JSONB_SET(v_person_forms, ARRAY [v_person], TO_JSONB(v_stem_text));
      END LOOP;
  ELSE
    FOR v_person, v_parts IN SELECT affix.key, affix.value FROM JSONB_EACH(p_affixes) AS affix
      LOOP
        IF JSONB_TYPEOF(p_template_value) = 'object' THEN
          v_stem_template := p_template_value ->> v_person;
          IF v_stem_template IS NULL THEN CONTINUE; END IF;
          v_stem_text := replace_root_placeholders(v_stem_template, p_c1, p_c2, p_c3);
        ELSE
          v_stem_text := replace_root_placeholders(p_template_value #>> '{}', p_c1, p_c2, p_c3);
          v_stem_text := v_stem_text || COALESCE(v_parts ->> 1, '');
        END IF;
        v_stem_text := normalize_arabic_orthography(v_stem_text);
        v_person_forms := JSONB_SET(v_person_forms, ARRAY [v_person], TO_JSONB(v_stem_text));
      END LOOP;
  END IF;
  RETURN v_person_forms;
END;
$$;

CREATE OR REPLACE FUNCTION build_person_forms
(
  p_affix_mood affix_mood,
  p_template_value jsonb,
  p_form_number INTEGER,
  p_use_affix BOOLEAN,
  p_c1 TEXT,
  p_c2 TEXT,
  p_c3 TEXT
) RETURNS jsonb
  LANGUAGE plpgsql
  STABLE AS
$$
BEGIN
  RETURN build_person_forms_from_affixes(
    p_template_value,
    (SELECT JSONB_OBJECT_AGG(person::text, JSONB_BUILD_ARRAY(prefix, suffix))
     FROM affix_rules
     WHERE mood = p_affix_mood
       AND form = p_form_number),
    p_use_affix,
    p_c1,
    p_c2,
    p_c3
  );
END;
$$;

CREATE OR REPLACE FUNCTION generate_conjugation_rows_from_affixes
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
  ROWS 8
AS
$$
DECLARE
  v_root TEXT := require_triliteral_root(root_text);
  c1 TEXT := SUBSTRING(v_root, 1, 1);
  c2 TEXT := SUBSTRING(v_root, 2, 1);
  c3 TEXT := SUBSTRING(v_root, 3, 1);
  mood_key TEXT;
  template_value jsonb;
  v_affix_mood affix_mood;
  v_person_forms jsonb;
  v_person_key TEXT;
  v_stem_template TEXT;
  v_stem_text TEXT;
BEGIN
  IF form_number = 8 THEN
    rules := assimilate_form_viii_infix(rules, c1);
  END IF;
  FOR mood_key IN SELECT JSONB_OBJECT_KEYS(rules)
    LOOP
      template_value := rules -> mood_key;
      IF template_value IS NULL THEN CONTINUE; END IF;
      IF p_no_affix THEN
        IF JSONB_TYPEOF(template_value) = 'object' THEN
          v_person_forms := '{}'::jsonb;
          FOR v_person_key IN SELECT person_key
                              FROM JSONB_OBJECT_KEYS(template_value) AS person_key
                              WHERE mood_key <> 'imperative' OR person_key LIKE 'second\_person\_%'
            LOOP
              v_stem_template := template_value ->> v_person_key;
              v_stem_text := replace_root_placeholders(v_stem_template, c1, c2, c3);
              v_stem_text := normalize_arabic_orthography(v_stem_text);
              v_person_forms := JSONB_SET(v_person_forms, ARRAY [v_person_key], TO_JSONB(v_stem_text));
            END LOOP;
        ELSE
          v_stem_text := replace_root_placeholders(template_value #>> '{}', c1, c2, c3);
          v_stem_text := normalize_arabic_orthography(v_stem_text);
          v_person_forms := '{}'::jsonb;
          FOR v_person_key IN SELECT person_key
                              FROM UNNEST(ARRAY [
                                'first_person_singular',
                                'second_person_masculine_singular',
                                'second_person_feminine_singular',
                                'third_person_masculine_singular',
                                'third_person_feminine_singular',
                                'second_person_dual',
                                'third_person_masculine_dual',
                                'third_person_feminine_dual',
                                'first_person_plural',
                                'second_person_masculine_plural',
                                'second_person_feminine_plural',
                                'third_person_masculine_plural',
                                'third_person_feminine_plural'
                                ]) AS person_key
                              WHERE mood_key <> 'imperative' OR person_key LIKE 'second\_person\_%'
            LOOP
              v_person_forms := JSONB_SET(v_person_forms, ARRAY [v_person_key], TO_JSONB(v_stem_text));
            END LOOP;
        END IF;
        IF mood_key IN
           ('perfect', 'imperative', 'imperfect_indicative', 'imperfect_subjunctive', 'imperfect_jussive') THEN
          v_affix_mood := mood_key::affix_mood;
          RETURN QUERY SELECT v_affix_mood, v_person_forms;
        ELSIF mood_key = 'imperfect_stem' THEN
          FOR
            v_affix_mood IN SELECT UNNEST(ARRAY [ 'imperfect_indicative'::affix_mood, 'imperfect_subjunctive'::affix_mood, 'imperfect_jussive'::affix_mood ])
            LOOP
              RETURN QUERY SELECT v_affix_mood, v_person_forms;
            END LOOP;
        END IF;
      ELSE
        IF mood_key IN ('perfect', 'imperative') THEN
          v_affix_mood := mood_key::affix_mood;
          v_person_forms := build_person_forms_from_affixes(template_value, p_affixes -> mood_key, FALSE, c1, c2, c3);
          RETURN QUERY SELECT v_affix_mood, v_person_forms;
        ELSIF mood_key IN ('imperfect_indicative', 'imperfect_subjunctive', 'imperfect_jussive') THEN
          v_affix_mood := mood_key::affix_mood;
          v_person_forms := build_person_forms_from_affixes(template_value, p_affixes -> mood_key, TRUE, c1, c2, c3);
          RETURN QUERY SELECT v_affix_mood, v_person_forms;
        ELSIF mood_key = 'imperfect_stem' THEN
          FOR
            v_affix_mood IN SELECT UNNEST(ARRAY [ 'imperfect_indicative'::affix_mood, 'imperfect_subjunctive'::affix_mood, 'imperfect_jussive'::affix_mood ])
            LOOP
              v_person_forms := build_person_forms_from_affixes(template_value, p_affixes -> v_affix_mood::text, TRUE,
                                                                c1, c2, c3);
              RETURN QUERY SELECT v_affix_mood, v_person_forms;
            END LOOP;
        END IF;
      END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION generate_conjugation_rows
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
AS
$$
BEGIN
  RETURN QUERY SELECT generated.mood, generated.person_forms
               FROM generate_conjugation_rows_from_affixes(root_text, rules, form_number, overrides, p_no_affix,
                                                           prepared_affix_rules(form_number)) AS generated;
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

CREATE OR REPLACE FUNCTION regenerate_all_derived_stems
(
) RETURNS void
  LANGUAGE plpgsql AS
$$
BEGIN
  PERFORM regenerate_derived_stems(ARRAY(SELECT id FROM lexical_entry ORDER BY id));
END;
$$;

CREATE OR REPLACE FUNCTION refresh_derived_stems_for_patterns
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
DECLARE
  verbal_noun_keys CONSTANT TEXT[] := ARRAY ['masdar', 'active_participle', 'passive_participle'];
  conjugation_patterns INTEGER[];
  noun_patterns INTEGER[];
BEGIN
  SELECT ARRAY_AGG(changed.id) FILTER (WHERE changed.conjugations_changed),
         ARRAY_AGG(changed.id) FILTER (WHERE NOT changed.conjugations_changed)
  INTO conjugation_patterns, noun_patterns
  FROM (SELECT revised.id,
               CASE
                 WHEN JSONB_TYPEOF(revised.rules) = 'object' AND JSONB_TYPEOF(original.rules) = 'object'
                   THEN (revised.form_number, revised.no_affix) IS DISTINCT FROM (original.form_number, original.no_affix)
                   OR (revised.rules - verbal_noun_keys) IS DISTINCT FROM (original.rules - verbal_noun_keys)
                 ELSE TRUE
                 END AS conjugations_changed
        FROM new_patterns revised
        JOIN old_patterns original ON original.id = revised.id
        WHERE (revised.rules, revised.form_number, revised.no_affix)
                IS DISTINCT FROM (original.rules, original.form_number, original.no_affix)) AS changed;

  IF conjugation_patterns IS NOT NULL THEN
    PERFORM regenerate_derived_stems(ARRAY(SELECT le.id
                                           FROM lexical_entry le
                                           WHERE le.morph_pattern_id = ANY (conjugation_patterns)
                                           ORDER BY le.id), TRUE);
  END IF;

  IF noun_patterns IS NOT NULL THEN
    PERFORM regenerate_derived_stems(ARRAY(SELECT le.id
                                           FROM lexical_entry le
                                           WHERE le.morph_pattern_id = ANY (noun_patterns)
                                           ORDER BY le.id), FALSE);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_derived_stems_after_pattern_update ON morph_pattern;

CREATE TRIGGER trg_refresh_derived_stems_after_pattern_update
  AFTER UPDATE
  ON morph_pattern
  REFERENCING OLD TABLE AS old_patterns NEW TABLE AS new_patterns
  FOR EACH STATEMENT
EXECUTE FUNCTION refresh_derived_stems_for_patterns();

DROP FUNCTION IF EXISTS refresh_derived_stems_for_pattern();
