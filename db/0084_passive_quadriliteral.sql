UPDATE morph_pattern mp
SET rules = mp.rules || v.passive
FROM (VALUES
  ('f1-a-i-quadriliteral', '{"passive_perfect": "{1}ُ{2}ْ{3}ِ{4}", "passive_imperfect_stem": "{1}َ{2}ْ{3}َ{4}"}'::jsonb)
) AS v(code, passive)
WHERE mp.id = morph_pattern_id_for_code(v.code)
  AND NOT has_passive_rules(mp.rules);
