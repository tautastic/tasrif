UPDATE morph_pattern mp
SET rules = mp.rules || v.passive
FROM (VALUES
  ('f1-a-u', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f1-a-i', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f1-a-a', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f1-i-a', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f1-i-i', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f1-a-u-hamza-elided-in-the-imperative', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f1-a-i-assimilated-waw', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f1-a-a-assimilated-waw', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f1-i-i-assimilated-waw', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f1-i-a-assimilated-waw', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f1-i-a-assimilated-waw-waw-elided', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f1-a-a-hamzated-third', '{"passive_perfect": "{1}ُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f2', '{"passive_perfect": "{1}ُ{2}ِّ{3}", "passive_imperfect_stem": "{1}َ{2}َّ{3}"}'::jsonb),
  ('f3', '{"passive_perfect": "{1}ُو{2}ِ{3}", "passive_imperfect_stem": "{1}َا{2}َ{3}"}'::jsonb),
  ('f4', '{"passive_perfect": "أُ{1}ْ{2}ِ{3}", "passive_imperfect_stem": "{1}ْ{2}َ{3}"}'::jsonb),
  ('f4-assimilated', '{"passive_perfect": "أُو{2}ِ{3}", "passive_imperfect_stem": "و{2}َ{3}"}'::jsonb),
  ('f5', '{"passive_perfect": "تُ{1}ُ{2}ِّ{3}", "passive_imperfect_stem": "تَ{1}َ{2}َّ{3}"}'::jsonb),
  ('f5-hamzated-second', '{"passive_perfect": "تُ{1}ُ{2}ِّ{3}", "passive_imperfect_stem": "تَ{1}َ{2}َّ{3}"}'::jsonb),
  ('f5-hamzated-third', '{"passive_perfect": "تُ{1}ُ{2}ِّ{3}", "passive_imperfect_stem": "تَ{1}َ{2}َّ{3}"}'::jsonb),
  ('f6', '{"passive_perfect": "تُ{1}ُو{2}ِ{3}", "passive_imperfect_stem": "تَ{1}َا{2}َ{3}"}'::jsonb),
  ('f8', '{"passive_perfect": "اُ{1}ْتُ{2}ِ{3}", "passive_imperfect_stem": "{1}ْتَ{2}َ{3}"}'::jsonb),
  ('f8-assimilated-waw', '{"passive_perfect": "اُتُّ{2}ِ{3}", "passive_imperfect_stem": "تَّ{2}َ{3}"}'::jsonb),
  ('f8-hamza-assimilated', '{"passive_perfect": "اُتُّ{2}ِ{3}", "passive_imperfect_stem": "تَّ{2}َ{3}"}'::jsonb),
  ('f10', '{"passive_perfect": "اُسْتُ{1}ْ{2}ِ{3}", "passive_imperfect_stem": "سْتَ{1}ْ{2}َ{3}"}'::jsonb),
  ('f10-assimilated-waw', '{"passive_perfect": "اُسْتُ{1}ْ{2}ِ{3}", "passive_imperfect_stem": "سْتَ{1}ْ{2}َ{3}"}'::jsonb),
  ('f10-hamzated-first', '{"passive_perfect": "اُسْتُ{1}ْ{2}ِ{3}", "passive_imperfect_stem": "سْتَ{1}ْ{2}َ{3}"}'::jsonb)
) AS v(code, passive)
WHERE mp.id = morph_pattern_id_for_code(v.code)
  AND NOT has_passive_rules(mp.rules);
