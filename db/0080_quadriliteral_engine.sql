CREATE OR REPLACE FUNCTION require_radical_count
(
  root_text TEXT,
  radical_count INTEGER
) RETURNS TEXT
  LANGUAGE plpgsql
  IMMUTABLE AS
$$
DECLARE
  cleaned TEXT;
BEGIN
  cleaned := strip_root_noise(root_text);

  IF CHAR_LENGTH(cleaned) IS DISTINCT FROM radical_count THEN
    RAISE EXCEPTION 'root ''%'' must have exactly % radicals after normalization, found %',
      root_text, radical_count, COALESCE(CHAR_LENGTH(cleaned), 0)
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

CREATE OR REPLACE FUNCTION require_triliteral_root
(
  root_text TEXT
) RETURNS TEXT
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT require_radical_count(root_text, 3)
$$;

CREATE OR REPLACE FUNCTION rules_radical_count
(
  rules JSONB
) RETURNS INTEGER
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT CASE WHEN POSITION('{4}' IN rules::text) > 0 THEN 4 ELSE 3 END
$$;

CREATE OR REPLACE FUNCTION affix_form_for
(
  form_number INTEGER,
  radical_count INTEGER DEFAULT 3
) RETURNS INTEGER
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT CASE
         WHEN radical_count = 4 THEN CASE form_number WHEN 1 THEN 2 WHEN 2 THEN 5 WHEN 3 THEN 7 WHEN 4 THEN 9 END
         ELSE form_number
         END
$$;

DROP FUNCTION IF EXISTS replace_root_placeholders(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION replace_root_placeholders
(
  template_text TEXT, c1 TEXT, c2 TEXT, c3 TEXT, c4 TEXT DEFAULT NULL
) RETURNS TEXT
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REPLACE(
         REPLACE(
           REPLACE(
             REPLACE(template_text, '{1}', canonical_hamza_root(c1)),
             '{2}',
             canonical_hamza_root(c2)
           ),
           '{3}',
           canonical_hamza_root(c3)
         ),
         '{4}',
         COALESCE(canonical_hamza_root(c4), '{4}')
       )
$$;

DROP FUNCTION IF EXISTS build_person_forms_from_affixes(JSONB, JSONB, BOOLEAN, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION build_person_forms_from_affixes
(
  p_template_value JSONB, p_affixes JSONB, p_use_affix BOOLEAN, p_c1 TEXT, p_c2 TEXT, p_c3 TEXT, p_c4 TEXT DEFAULT NULL
) RETURNS JSONB
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
          v_stem_text := replace_root_placeholders(v_stem_template, p_c1, p_c2, p_c3, p_c4);
        ELSE
          v_stem_text := replace_root_placeholders(p_template_value #>> '{}', p_c1, p_c2, p_c3, p_c4);
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
          v_stem_text := replace_root_placeholders(v_stem_template, p_c1, p_c2, p_c3, p_c4);
        ELSE
          v_stem_text := replace_root_placeholders(p_template_value #>> '{}', p_c1, p_c2, p_c3, p_c4);
          v_stem_text := v_stem_text || COALESCE(v_parts ->> 1, '');
        END IF;
        v_stem_text := normalize_arabic_orthography(v_stem_text);
        v_person_forms := JSONB_SET(v_person_forms, ARRAY [v_person], TO_JSONB(v_stem_text));
      END LOOP;
  END IF;
  RETURN v_person_forms;
END;
$$;

DROP FUNCTION IF EXISTS prepared_affix_rules(INTEGER);

CREATE OR REPLACE FUNCTION prepared_affix_rules
(
  p_form_number INTEGER,
  p_radical_count INTEGER DEFAULT 3
) RETURNS JSONB
  LANGUAGE plpgsql
  STABLE AS
$$
DECLARE
  v_affix_form CONSTANT INTEGER := affix_form_for(p_form_number, p_radical_count);
BEGIN
  RETURN (SELECT COALESCE(JSONB_OBJECT_AGG(grouped.mood, grouped.persons), '{}'::jsonb)
          FROM (SELECT rule.mood::text AS mood,
                       JSONB_OBJECT_AGG(rule.person::text, JSONB_BUILD_ARRAY(rule.prefix, rule.suffix)) AS persons
                FROM affix_rules rule
                WHERE (rule.mood IN ('perfect', 'imperative') AND rule.form = 0)
                   OR (rule.mood IN ('imperfect_indicative', 'imperfect_subjunctive', 'imperfect_jussive')
                     AND rule.form = v_affix_form)
                GROUP BY rule.mood) AS grouped);
END;
$$;

CREATE OR REPLACE FUNCTION generate_verbal_nouns
(
  root_text TEXT, rules JSONB, form_number INTEGER, overrides JSONB DEFAULT '{}'::jsonb,
  p_no_passive BOOLEAN DEFAULT FALSE
) RETURNS TABLE
          (
            masdar             TEXT,
            active_participle  TEXT,
            passive_participle TEXT
          )
  LANGUAGE plpgsql
  STABLE AS
$$
DECLARE
  v_radicals INTEGER := rules_radical_count(rules);
  v_root TEXT := require_radical_count(root_text, v_radicals);
  c1 TEXT := SUBSTRING(v_root, 1, 1);
  c2 TEXT := SUBSTRING(v_root, 2, 1);
  c3 TEXT := SUBSTRING(v_root, 3, 1);
  c4 TEXT := CASE WHEN v_radicals = 4 THEN SUBSTRING(v_root, 4, 1) END;
  template_value jsonb;
  v_stem_text TEXT;
BEGIN
  IF form_number = 8 THEN
    rules := assimilate_form_viii_infix(rules, c1);
  END IF;
  template_value := rules -> 'masdar';
  IF template_value IS NOT NULL THEN
    IF overrides ? 'masdar_override' THEN
      v_stem_text := overrides ->> 'masdar_override';
    ELSE
      v_stem_text := replace_root_placeholders(template_value #>> '{}', c1, c2, c3, c4);
    END IF;
    v_stem_text := normalize_arabic_orthography(v_stem_text);
    masdar := v_stem_text;
  END IF;
  template_value := rules -> 'active_participle';
  IF template_value IS NOT NULL THEN
    IF overrides ? 'active_participle_override' THEN
      v_stem_text := overrides ->> 'active_participle_override';
    ELSE
      v_stem_text := replace_root_placeholders(template_value #>> '{}', c1, c2, c3, c4);
    END IF;
    v_stem_text := normalize_arabic_orthography(v_stem_text);
    active_participle := v_stem_text;
  END IF;
  IF p_no_passive THEN
    passive_participle := NULL;
  ELSE
    template_value := rules -> 'passive_participle';
    IF template_value IS NOT NULL THEN
      IF overrides ? 'passive_participle_override' THEN
        v_stem_text := overrides ->> 'passive_participle_override';
      ELSE
        v_stem_text := replace_root_placeholders(template_value #>> '{}', c1, c2, c3, c4);
      END IF;
      v_stem_text := normalize_arabic_orthography(v_stem_text);
      passive_participle := v_stem_text;
    END IF;
  END IF;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION generate_conjugation_rows_from_affixes
(
  root_text TEXT, rules JSONB, form_number INTEGER, overrides JSONB, p_no_affix BOOLEAN, p_affixes JSONB
) RETURNS TABLE
          (
            mood         affix_mood,
            person_forms JSONB
          )
  LANGUAGE plpgsql
  STABLE ROWS 8 AS
$$
DECLARE
  v_radicals INTEGER := rules_radical_count(rules);
  v_root TEXT := require_radical_count(root_text, v_radicals);
  c1 TEXT := SUBSTRING(v_root, 1, 1);
  c2 TEXT := SUBSTRING(v_root, 2, 1);
  c3 TEXT := SUBSTRING(v_root, 3, 1);
  c4 TEXT := CASE WHEN v_radicals = 4 THEN SUBSTRING(v_root, 4, 1) END;
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
              v_stem_text := replace_root_placeholders(v_stem_template, c1, c2, c3, c4);
              v_stem_text := normalize_arabic_orthography(v_stem_text);
              v_person_forms := JSONB_SET(v_person_forms, ARRAY [v_person_key], TO_JSONB(v_stem_text));
            END LOOP;
        ELSE
          v_stem_text := replace_root_placeholders(template_value #>> '{}', c1, c2, c3, c4);
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
          v_person_forms := build_person_forms_from_affixes(template_value, p_affixes -> mood_key, FALSE, c1, c2, c3, c4);
          RETURN QUERY SELECT v_affix_mood, v_person_forms;
        ELSIF mood_key IN ('imperfect_indicative', 'imperfect_subjunctive', 'imperfect_jussive') THEN
          v_affix_mood := mood_key::affix_mood;
          v_person_forms := build_person_forms_from_affixes(template_value, p_affixes -> mood_key, TRUE, c1, c2, c3, c4);
          RETURN QUERY SELECT v_affix_mood, v_person_forms;
        ELSIF mood_key = 'imperfect_stem' THEN
          FOR
            v_affix_mood IN SELECT UNNEST(ARRAY [ 'imperfect_indicative'::affix_mood, 'imperfect_subjunctive'::affix_mood, 'imperfect_jussive'::affix_mood ])
            LOOP
              v_person_forms := build_person_forms_from_affixes(template_value, p_affixes -> v_affix_mood::text, TRUE,
                                                                c1, c2, c3, c4);
              RETURN QUERY SELECT v_affix_mood, v_person_forms;
            END LOOP;
        END IF;
      END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION generate_conjugation_rows
(
  root_text TEXT, rules JSONB, form_number INTEGER, overrides JSONB DEFAULT '{}'::jsonb,
  p_no_affix BOOLEAN DEFAULT FALSE
) RETURNS TABLE
          (
            mood         affix_mood,
            person_forms JSONB
          )
  LANGUAGE plpgsql
  STABLE AS
$$
BEGIN
  RETURN QUERY SELECT generated.mood, generated.person_forms
               FROM generate_conjugation_rows_from_affixes(root_text, rules, form_number, overrides, p_no_affix,
                                                           prepared_affix_rules(form_number, rules_radical_count(rules))) AS generated;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_lexical_entry_root()
  RETURNS trigger
  LANGUAGE plpgsql AS
$$
DECLARE
  v_radicals INTEGER;
BEGIN
  NEW.root := NULLIF(strip_root_noise(NEW.root), '');

  IF NEW.morph_pattern_id IS NOT NULL AND NEW.root IS NOT NULL THEN
    SELECT radical_count INTO v_radicals FROM morph_pattern WHERE id = NEW.morph_pattern_id;
    v_radicals := COALESCE(v_radicals, 3);
    IF CHAR_LENGTH(NEW.root) <> v_radicals THEN
      RAISE EXCEPTION 'root ''%'' must have exactly % radicals when a morphological pattern is attached, found %',
        NEW.root, v_radicals, CHAR_LENGTH(NEW.root)
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
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

  IF v_morph_pattern_id IS NOT NULL THEN
    SELECT rules, form_number, no_affix
    INTO pattern_rules, v_form_number, v_no_affix
    FROM morph_pattern
    WHERE id = v_morph_pattern_id
      AND radical_count = CHAR_LENGTH(v_root);
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
          SELECT mp.id, mp.rules, mp.form_number, mp.no_affix, mp.radical_count
          FROM morph_pattern mp
          WHERE mp.id IN (SELECT e.morph_pattern_id FROM batch_entries e)
            AND JSONB_TYPEOF(mp.rules) = 'object'
        ), targets AS (
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
        ), affixes AS (
          SELECT forms.form_number, forms.radical_count, prepared_affix_rules(forms.form_number, forms.radical_count) AS prepared
          FROM (SELECT DISTINCT form_number, radical_count FROM targets) AS forms
        ), generated AS (
          SELECT t.id AS entry_id,
                 cr.mood,
                 kv.key::person_type AS person,
                 kv.value AS form,
                 cr.mood_order,
                 kv.person_order
          FROM targets t
          JOIN affixes a ON a.form_number = t.form_number AND a.radical_count = t.radical_count
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
        SELECT mp.id, mp.rules, mp.form_number, mp.radical_count
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
        WHERE CHAR_LENGTH(strip_root_noise(e.root)) = p.radical_count
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

CREATE OR REPLACE FUNCTION fill_morph_pattern_resolution()
  RETURNS trigger
  LANGUAGE plpgsql AS
$$
DECLARE
  v_pattern RECORD;
BEGIN
  SELECT form_number, radical_count, perfect_vowel, imperfect_vowel, is_lexical, code
  INTO v_pattern
  FROM morph_pattern
  WHERE id = NEW.morph_pattern_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'morph_pattern % does not exist', NEW.morph_pattern_id
      USING ERRCODE = '23503';
  END IF;

  IF v_pattern.is_lexical THEN
    RAISE EXCEPTION 'pattern % is lexical: it is reached through lexical_pattern_override, never by root shape',
      v_pattern.code
      USING ERRCODE = '23514';
  END IF;

  NEW.form_number := v_pattern.form_number;
  NEW.radical_count := v_pattern.radical_count;
  NEW.perfect_vowel := v_pattern.perfect_vowel;
  NEW.imperfect_vowel := v_pattern.imperfect_vowel;
  RETURN NEW;
END;
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

    shape_changed := (NEW.radical1_kind, NEW.radical2_kind, NEW.radical3_kind, NEW.is_geminate)
      IS DISTINCT FROM (OLD.radical1_kind, OLD.radical2_kind, OLD.radical3_kind, OLD.is_geminate);

    IF shape_changed AND NOT OLD.is_lexical THEN
      DELETE FROM morph_pattern_resolution r
      WHERE r.morph_pattern_id = NEW.id
        AND (r.radical1_kind, r.radical2_kind, r.radical3_kind, r.is_geminate)
        = (OLD.radical1_kind, OLD.radical2_kind, OLD.radical3_kind, OLD.is_geminate);
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
                                        is_geminate)
  SELECT NEW.id, NEW.radical_count, NEW.radical1_kind, NEW.radical2_kind, NEW.radical3_kind, NEW.is_geminate
  WHERE NOT EXISTS (SELECT 1
                    FROM morph_pattern_resolution r
                    WHERE r.morph_pattern_id = NEW.id
                      AND (r.radical1_kind, r.radical2_kind, r.radical3_kind, r.is_geminate)
                      = (NEW.radical1_kind, NEW.radical2_kind, NEW.radical3_kind, NEW.is_geminate));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_morph_pattern_resolution ON morph_pattern;

CREATE TRIGGER trg_sync_morph_pattern_resolution
  AFTER INSERT OR UPDATE OF form_number, radical_count, perfect_vowel, imperfect_vowel, radical1_kind, radical2_kind,
    radical3_kind, is_geminate, is_lexical
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
  v_existing   RECORD;
  v_id         INTEGER;
BEGIN
  IF v_radicals = 4 THEN
    PERFORM require_radical_count(p_example_root, 4);
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
    AND r.is_geminate = v_shape.is_geminate;

  IF FOUND THEN
    IF v_existing.morph_pattern_id = v_pattern_id THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'the root shape of % already resolves to pattern % for this verb form, not to %',
      p_example_root, v_existing.code, p_code
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO morph_pattern_resolution (morph_pattern_id, radical1_kind, radical2_kind, radical3_kind, is_geminate)
  VALUES (v_pattern_id, v_shape.radical1, v_shape.radical2, v_shape.radical3, v_shape.is_geminate)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION describe_quadriliteral_root
(
  root_text TEXT
) RETURNS TEXT[]
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT ARRAY_REMOVE(ARRAY [
  'quadriliteral',
  CASE WHEN classify_root_radical(SUBSTRING(cleaned FROM 4 FOR 1)) IN ('waw', 'ya') THEN 'final-weak' END,
  CASE
    WHEN 'hamza' IN (classify_root_radical(SUBSTRING(cleaned FROM 1 FOR 1)),
                     classify_root_radical(SUBSTRING(cleaned FROM 2 FOR 1)),
                     classify_root_radical(SUBSTRING(cleaned FROM 3 FOR 1)),
                     classify_root_radical(SUBSTRING(cleaned FROM 4 FOR 1)))
      THEN 'hamzated' END,
  CASE
    WHEN SUBSTRING(cleaned FROM 1 FOR 1) = SUBSTRING(cleaned FROM 3 FOR 1)
      AND SUBSTRING(cleaned FROM 2 FOR 1) = SUBSTRING(cleaned FROM 4 FOR 1)
      THEN 'reduplicated' END
  ], NULL)
FROM (SELECT require_radical_count(root_text, 4) AS cleaned) AS checked
$$;

DROP FUNCTION IF EXISTS resolve_morph_pattern_id(TEXT, INTEGER, short_vowel, short_vowel);

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
  resolved_id     INTEGER;
  cleaned         TEXT;
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
    cleaned := require_radical_count(root_text, 4);
    IF classify_root_radical(SUBSTRING(cleaned FROM 4 FOR 1)) IN ('waw', 'ya') THEN
      RETURN NULL;
    END IF;
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
    AND is_geminate = classification.is_geminate;

  RETURN resolved_id;
END;
$$;
