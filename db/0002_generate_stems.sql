CREATE OR REPLACE FUNCTION replace_root_placeholders
(
  template_text TEXT, c1 TEXT, c2 TEXT, c3 TEXT
) RETURNS TEXT
  LANGUAGE sql
  IMMUTABLE AS
$$
SELECT REPLACE(REPLACE(REPLACE(template_text, '{1}', c1), '{2}', c2), '{3}', c3)
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
        v_stem_text := v_affix.prefix || v_stem_text || v_affix.suffix;
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
          v_stem_text := v_stem_text || v_affix.suffix;
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
  c1 TEXT := SUBSTRING(root_text, 1, 1);
  c2 TEXT := SUBSTRING(root_text, 2, 1);
  c3 TEXT := SUBSTRING(root_text, 3, 1);
  template_value jsonb;
  v_stem_text TEXT;
BEGIN
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
  c1 TEXT := SUBSTRING(root_text, 1, 1);
  c2 TEXT := SUBSTRING(root_text, 2, 1);
  c3 TEXT := SUBSTRING(root_text, 3, 1);
  mood_key TEXT;
  template_value jsonb;
  v_affix_mood affix_mood;
  v_person_forms jsonb;
  v_person_key TEXT;
  v_stem_template TEXT;
  v_stem_text TEXT;
BEGIN
  FOR mood_key IN SELECT JSONB_OBJECT_KEYS(rules)
    LOOP
      template_value := rules -> mood_key;
      IF template_value IS NULL THEN CONTINUE; END IF;
      IF p_no_affix THEN
        IF JSONB_TYPEOF(template_value) = 'object' THEN
          v_person_forms := '{}'::jsonb;
          FOR v_person_key IN SELECT JSONB_OBJECT_KEYS(template_value)
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
          FOR v_person_key IN SELECT UNNEST(ARRAY [
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
            ])
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
BEGIN
  SELECT root, morph_pattern_id, morphology_overrides
  INTO v_root, v_morph_pattern_id, v_morphology_overrides
  FROM lexical_entry
  WHERE id = p_entry_id;

  IF v_morph_pattern_id IS NOT NULL AND v_root IS NOT NULL AND LENGTH(v_root) >= 3 THEN
    SELECT rules, form_number, no_affix
    INTO pattern_rules, v_form_number, v_no_affix
    FROM morph_pattern
    WHERE id = v_morph_pattern_id;
    IF pattern_rules IS NOT NULL THEN
      v_no_passive := COALESCE((v_morphology_overrides ->> 'no_passive')::boolean, FALSE);
      UPDATE lexical_entry
      SET masdar             = vn.masdar,
          active_participle  = vn.active_participle,
          passive_participle = vn.passive_participle
      FROM generate_verbal_nouns(v_root, pattern_rules, v_form_number,
                                 COALESCE(v_morphology_overrides, '{}'::jsonb), v_no_passive) AS vn
      WHERE id = p_entry_id;
      DELETE FROM conjugation WHERE lexical_entry_id = p_entry_id;
      INSERT INTO conjugation (lexical_entry_id, voice, mood, person, form)
      SELECT p_entry_id, 'active', cr.mood, kv.key::person_type, kv.value
      FROM generate_conjugation_rows(v_root, pattern_rules, v_form_number,
                                     COALESCE(v_morphology_overrides, '{}'::jsonb),
                                     v_no_affix) AS cr,
           LATERAL jsonb_each_text(cr.person_forms) AS kv(key, value)
      WHERE kv.value IS NOT NULL AND kv.value <> '';
    ELSE
      UPDATE lexical_entry SET masdar = NULL, active_participle = NULL, passive_participle = NULL WHERE id = p_entry_id;
      DELETE FROM conjugation WHERE lexical_entry_id = p_entry_id;
    END IF;
  ELSE
    UPDATE lexical_entry SET masdar = NULL, active_participle = NULL, passive_participle = NULL WHERE id = p_entry_id;
    DELETE FROM conjugation WHERE lexical_entry_id = p_entry_id;
  END IF;
  PERFORM recalculate_search_vector(p_entry_id);
END;
$$;

CREATE OR REPLACE FUNCTION regenerate_all_derived_stems
(
) RETURNS void
  LANGUAGE plpgsql AS
$$
DECLARE
  v_entry_id INTEGER;
BEGIN
  FOR v_entry_id IN SELECT id FROM lexical_entry
    LOOP
      PERFORM regenerate_derived_stems_for_entry(v_entry_id);
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION update_lexical_entry_derived_stems
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
DECLARE
  stems_changed BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    stems_changed := TRUE;
  ELSE
    IF NEW.root IS DISTINCT FROM OLD.root OR NEW.morph_pattern_id IS DISTINCT FROM OLD.morph_pattern_id OR
       NEW.morphology_overrides IS DISTINCT FROM OLD.morphology_overrides THEN
      stems_changed := TRUE;
    END IF;
  END IF;
  IF stems_changed THEN
    PERFORM regenerate_derived_stems_for_entry(NEW.id);
  ELSE
    PERFORM recalculate_search_vector(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_update_lexical_entry_derived_stems
  AFTER INSERT OR UPDATE OF root, morph_pattern_id, morphology_overrides, text
  ON lexical_entry
  FOR EACH ROW
EXECUTE FUNCTION update_lexical_entry_derived_stems();

CREATE OR REPLACE FUNCTION refresh_derived_stems_for_pattern
(
) RETURNS TRIGGER AS
$$
DECLARE
  v_entry_id INTEGER;
BEGIN
  FOR v_entry_id IN SELECT id FROM lexical_entry WHERE morph_pattern_id = NEW.id
    LOOP
      PERFORM regenerate_derived_stems_for_entry(v_entry_id);
    END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_refresh_derived_stems_after_pattern_update
  AFTER UPDATE OF rules, form_number
  ON morph_pattern
  FOR EACH ROW
EXECUTE FUNCTION refresh_derived_stems_for_pattern();