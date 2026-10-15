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
    SELECT mp.id, mp.rules, mp.form_number, mp.no_affix, mp.radical_count
    FROM morph_pattern mp
    WHERE mp.id IN (SELECT e.morph_pattern_id FROM batch_entries e)
      AND has_passive_rules(mp.rules)
  ), targets AS MATERIALIZED (
    SELECT e.id,
           strip_root_noise(e.root) AS root,
           COALESCE(e.morphology_overrides, '{}'::jsonb) AS overrides,
           p.rules,
           p.form_number,
           p.no_affix,
           p.radical_count
    FROM batch_entries e
    JOIN patterns p ON p.id = e.morph_pattern_id
    WHERE CHAR_LENGTH(strip_root_noise(e.root)) = p.radical_count
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
