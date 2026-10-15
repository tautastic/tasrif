INSERT INTO lexical_pattern_override (root, form_number, perfect_vowel, imperfect_vowel, variant, morph_pattern_id, note)
VALUES ('جوب', 10, NULL, NULL, 'interrogate', morph_pattern_id_for_code('f10-hollow-strong-inflection'),
        'اِسْتَجْوَبَ (to interrogate) takes the strong inflection in form X, Wright vol. I §163; اِسْتَجَابَ (to respond) of the same root stays hollow.')
ON CONFLICT ON CONSTRAINT unique_lexical_pattern_override_key DO NOTHING;
