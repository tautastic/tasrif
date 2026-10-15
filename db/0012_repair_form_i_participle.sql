UPDATE morph_pattern
SET rules = JSONB_SET(rules, '{active_participle}', TO_JSONB(U&'{1}\064E\0627{2}\0650{3}'::text))
WHERE form_number = 1
  AND perfect_vowel = 'i'
  AND imperfect_vowel = 'i'
  AND rules ->> 'active_participle' = U&'\0623\064E{1}\0652{2}\064E{3}';

SELECT regenerate_all_derived_stems();
