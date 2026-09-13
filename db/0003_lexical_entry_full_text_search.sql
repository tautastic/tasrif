CREATE OR REPLACE FUNCTION recalculate_search_vector
(
  p_entry_id INTEGER
) RETURNS void
  LANGUAGE plpgsql AS
$$
DECLARE
  v_search_text TEXT;
BEGIN
  SELECT le.text || ' ' || le.normalized_text || ' ' || COALESCE(le.masdar, '') || ' ' ||
         COALESCE(le.active_participle, '') || ' ' || COALESCE(le.passive_participle, '') || ' ' || COALESCE(
           (SELECT STRING_AGG(
                     COALESCE(c.first_person_singular, '') || ' ' || COALESCE(c.second_person_masculine_singular, '') ||
                     ' ' || COALESCE(c.second_person_feminine_singular, '') || ' ' ||
                     COALESCE(c.third_person_masculine_singular, '') || ' ' ||
                     COALESCE(c.third_person_feminine_singular, '') || ' ' || COALESCE(c.second_person_dual, '') ||
                     ' ' || COALESCE(c.third_person_masculine_dual, '') || ' ' ||
                     COALESCE(c.third_person_feminine_dual, '') || ' ' || COALESCE(c.first_person_plural, '') || ' ' ||
                     COALESCE(c.second_person_masculine_plural, '') || ' ' ||
                     COALESCE(c.second_person_feminine_plural, '') || ' ' ||
                     COALESCE(c.third_person_masculine_plural, '') || ' ' ||
                     COALESCE(c.third_person_feminine_plural, ''), ' ')
            FROM conjugation c
            WHERE c.lexical_entry_id = le.id), '')
  INTO v_search_text
  FROM lexical_entry le
  WHERE le.id = p_entry_id;

  UPDATE lexical_entry
  SET search_vector = TO_TSVECTOR('arabic', v_search_text)
  WHERE id = p_entry_id;
END;
$$;
