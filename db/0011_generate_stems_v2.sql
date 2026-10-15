CREATE OR REPLACE FUNCTION assimilate_form_viii_infix
(
  rules jsonb,
  c1 TEXT
) RETURNS jsonb
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT CASE
         WHEN c1 IN ('ص', 'ض', 'ط', 'ظ')
           THEN REPLACE(rules::text, U&'{1}\0652\062A', U&'{1}\0652\0637')::jsonb
         WHEN c1 IN ('ز', 'د')
           THEN REPLACE(rules::text, U&'{1}\0652\062A', U&'{1}\0652\062F')::jsonb
         WHEN c1 = 'ذ'
           THEN REPLACE(rules::text, U&'{1}\0652\062A', U&'\062F\0652\062F')::jsonb
         WHEN c1 = 'ث'
           THEN REPLACE(rules::text, U&'{1}\0652\062A', U&'{1}\0652\062B')::jsonb
         ELSE rules
         END
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
DECLARE
  v_person_forms jsonb := '{}'::jsonb;
  v_affix RECORD;
  v_stem_template TEXT;
  v_stem_text TEXT;
BEGIN
  IF p_use_affix THEN
    FOR v_affix IN SELECT person, prefix, suffix FROM affix_rules WHERE mood = p_affix_mood AND form = p_form_number
      LOOP
        IF JSONB_TYPEOF(p_template_value) = 'object' THEN
          v_stem_template := p_template_value ->> v_affix.person::text;
          IF v_stem_template IS NULL THEN CONTINUE; END IF;
          v_stem_text := replace_root_placeholders(v_stem_template, p_c1, p_c2, p_c3);
        ELSE
          v_stem_text := replace_root_placeholders(p_template_value #>> '{}', p_c1, p_c2, p_c3);
        END IF;
        v_stem_text := COALESCE(v_affix.prefix, '') || v_stem_text || COALESCE(v_affix.suffix, '');
        v_stem_text := normalize_arabic_orthography(v_stem_text);
        v_person_forms := JSONB_SET(v_person_forms, ARRAY [v_affix.person::text], TO_JSONB(v_stem_text));
      END LOOP;
  ELSE
    FOR v_affix IN SELECT person, suffix FROM affix_rules WHERE mood = p_affix_mood AND form = p_form_number
      LOOP
        IF JSONB_TYPEOF(p_template_value) = 'object' THEN
          v_stem_template := p_template_value ->> v_affix.person::text;
          IF v_stem_template IS NULL THEN CONTINUE; END IF;
          v_stem_text := replace_root_placeholders(v_stem_template, p_c1, p_c2, p_c3);
        ELSE
          v_stem_text := replace_root_placeholders(p_template_value #>> '{}', p_c1, p_c2, p_c3);
          v_stem_text := v_stem_text || COALESCE(v_affix.suffix, '');
        END IF;
        v_stem_text := normalize_arabic_orthography(v_stem_text);
        v_person_forms := JSONB_SET(v_person_forms, ARRAY [v_affix.person::text], TO_JSONB(v_stem_text));
      END LOOP;
  END IF;
  RETURN v_person_forms;
END;
$$;

CREATE OR REPLACE FUNCTION generate_verbal_nouns
(
  root_text TEXT,
  rules jsonb,
  form_number INTEGER,
  overrides jsonb DEFAULT '{}'::jsonb,
  p_no_passive boolean DEFAULT FALSE
)
  RETURNS TABLE
          (
            masdar             text,
            active_participle  text,
            passive_participle text
          )
  LANGUAGE plpgsql
  STABLE
AS
$$
DECLARE
  v_root TEXT := require_triliteral_root(root_text);
  c1 TEXT := SUBSTRING(v_root, 1, 1);
  c2 TEXT := SUBSTRING(v_root, 2, 1);
  c3 TEXT := SUBSTRING(v_root, 3, 1);
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
      v_stem_text := replace_root_placeholders(template_value #>> '{}', c1, c2, c3);
    END IF;
    v_stem_text := normalize_arabic_orthography(v_stem_text);
    masdar := v_stem_text;
  END IF;
  template_value := rules -> 'active_participle';
  IF template_value IS NOT NULL THEN
    IF overrides ? 'active_participle_override' THEN
      v_stem_text := overrides ->> 'active_participle_override';
    ELSE
      v_stem_text := replace_root_placeholders(template_value #>> '{}', c1, c2, c3);
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
        v_stem_text := replace_root_placeholders(template_value #>> '{}', c1, c2, c3);
      END IF;
      v_stem_text := normalize_arabic_orthography(v_stem_text);
      passive_participle := v_stem_text;
    END IF;
  END IF;
  RETURN NEXT;
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
          v_person_forms := build_person_forms(v_affix_mood, template_value, 0, FALSE, c1, c2, c3);
          RETURN QUERY SELECT v_affix_mood, v_person_forms;
        ELSIF mood_key IN ('imperfect_indicative', 'imperfect_subjunctive', 'imperfect_jussive') THEN
          v_affix_mood := mood_key::affix_mood;
          v_person_forms := build_person_forms(v_affix_mood, template_value, form_number, TRUE, c1, c2, c3);
          RETURN QUERY SELECT v_affix_mood, v_person_forms;
        ELSIF mood_key = 'imperfect_stem' THEN
          FOR
            v_affix_mood IN SELECT UNNEST(ARRAY [ 'imperfect_indicative'::affix_mood, 'imperfect_subjunctive'::affix_mood, 'imperfect_jussive'::affix_mood ])
            LOOP
              v_person_forms := build_person_forms(v_affix_mood, template_value, form_number, TRUE, c1, c2, c3);
              RETURN QUERY SELECT v_affix_mood, v_person_forms;
            END LOOP;
        END IF;
      END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION build_search_vector
(
  p_entry_id INTEGER,
  p_language lang_type,
  p_text TEXT,
  p_normalized_text TEXT,
  p_masdar TEXT,
  p_active_participle TEXT,
  p_passive_participle TEXT
) RETURNS tsvector
  LANGUAGE sql
  STABLE AS
$$
SELECT TO_TSVECTOR(
         CASE p_language WHEN 'en' THEN 'english'::regconfig ELSE 'arabic'::regconfig END,
         p_text || ' ' || p_normalized_text || ' ' || COALESCE(p_masdar, '') || ' ' ||
         COALESCE(p_active_participle, '') || ' ' || COALESCE(p_passive_participle, '') || ' ' ||
         COALESCE((SELECT STRING_AGG(c.form, ' ' ORDER BY c.id) FROM conjugation c WHERE c.lexical_entry_id = p_entry_id),
                  '')
       )
$$;

CREATE OR REPLACE FUNCTION recalculate_search_vector
(
  p_entry_id INTEGER
) RETURNS void
  LANGUAGE plpgsql AS
$$
BEGIN
  UPDATE lexical_entry le
  SET search_vector = build_search_vector(le.id, le.language, le.text, le.normalized_text, le.masdar,
                                          le.active_participle, le.passive_participle)
  WHERE le.id = p_entry_id;
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
      AND NOT EXISTS (SELECT 1 FROM generated g WHERE c.voice = 'active' AND g.mood = c.mood AND g.person = c.person);
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
