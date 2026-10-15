CREATE OR REPLACE FUNCTION normalize_morph_pattern_alternative_noun_root
(
) RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
BEGIN
  NEW.root := NULLIF(strip_root_noise(NEW.root), '');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_normalize_morph_pattern_alternative_noun_root
  BEFORE INSERT OR UPDATE OF root
  ON morph_pattern_alternative_noun
  FOR EACH ROW
  WHEN (NEW.root IS NOT NULL)
EXECUTE FUNCTION normalize_morph_pattern_alternative_noun_root();

CREATE OR REPLACE FUNCTION entry_alternative_nouns
(
  p_entry_ids INTEGER[]
) RETURNS TABLE
          (
            lexical_entry_id INTEGER,
            noun             alternative_noun_kind,
            ordinal          SMALLINT,
            form             TEXT
          )
  LANGUAGE plpgsql
  STABLE
  ROWS 4
  SET plan_cache_mode = force_generic_plan
AS
$$
BEGIN
  RETURN QUERY
SELECT picked.entry_id, picked.noun, picked.ordinal, picked.form
FROM (SELECT DISTINCT ON (e.id, a.noun, evaluated.form) e.id AS entry_id,
                                                         a.noun,
                                                         a.ordinal,
                                                         evaluated.form
      FROM UNNEST(p_entry_ids) AS wanted (id)
             JOIN lexical_entry e ON e.id = wanted.id
             JOIN morph_pattern p ON p.id = e.morph_pattern_id
             CROSS JOIN LATERAL (SELECT strip_root_noise(e.root) AS root) cleaned
             JOIN morph_pattern_alternative_noun a
                  ON a.morph_pattern_id = p.id
                    AND (a.root IS NULL OR canonical_hamza_root(a.root) = canonical_hamza_root(cleaned.root))
             CROSS JOIN LATERAL (SELECT CASE
                                          WHEN a.verbatim THEN placeholders.text
                                          ELSE normalize_arabic_orthography(placeholders.text)
                                          END AS form
                                 FROM (SELECT replace_root_placeholders(
                                                CASE
                                                  WHEN p.form_number = 8 AND p.radical_count = 3
                                                    THEN assimilate_form_viii_infix(TO_JSONB(a.template),
                                                                                    SUBSTRING(cleaned.root, 1, 1)) #>> '{}'
                                                  ELSE a.template
                                                  END,
                                                SUBSTRING(cleaned.root, 1, 1),
                                                SUBSTRING(cleaned.root, 2, 1),
                                                SUBSTRING(cleaned.root, 3, 1),
                                                CASE WHEN p.radical_count = 4 THEN SUBSTRING(cleaned.root, 4, 1) END
                                              ) AS text) placeholders) evaluated
             CROSS JOIN LATERAL (SELECT CASE a.noun
                                          WHEN 'masdar' THEN e.masdar
                                          WHEN 'active_participle' THEN e.active_participle
                                          ELSE e.passive_participle
                                          END AS form) stored
      WHERE CHAR_LENGTH(cleaned.root) = p.radical_count
        AND stored.form <> evaluated.form
      ORDER BY e.id, a.noun, evaluated.form, a.ordinal) picked
ORDER BY picked.entry_id, picked.noun, picked.ordinal;
END;
$$;

INSERT INTO morph_pattern_alternative_noun (morph_pattern_id, root, noun, ordinal, template, note, verbatim)
SELECT morph_pattern_id_for_code(v.code), v.root, v.noun::alternative_noun_kind, v.ordinal, v.template, v.note, FALSE
FROM (VALUES
       ('f1-a-i-quadriliteral', 'زلزل', 'masdar', 1, '{1}ِ{2}ْ{3}َا{4}',
        'The Wiktionary conjugation table of زَلْزَلَ (revision 93326305) prints the verbal nouns زَلْزَلَة and زِلْزَال. Wright vol. I §203 gives the verbal noun فِعْلَال for reduplicated verbs.'),
       ('f1-a-i-quadriliteral', 'ثرثر', 'masdar', 1, '{1}َ{2}ْ{3}َا{4}',
        'The Wiktionary conjugation table of ثَرْثَرَ (revision 93324245) prints the verbal nouns ثَرْثَرَة and ثَرْثَار.'),
       ('f1-a-i-quadriliteral', 'وسوس', 'masdar', 1, '{1}َ{2}ْ{3}َا{4}',
        'The Wiktionary conjugation table of وَسْوَسَ (revision 92748836) prints the verbal nouns وَسْوَسَة, وَسْوَاس and وِسْوَاس.'),
       ('f1-a-i-quadriliteral', 'وسوس', 'masdar', 2, '{1}ِ{2}ْ{3}َا{4}',
        'The Wiktionary conjugation table of وَسْوَسَ (revision 92748836) prints the verbal nouns وَسْوَسَة, وَسْوَاس and وِسْوَاس.')
     ) AS v (code, root, noun, ordinal, template, note);
