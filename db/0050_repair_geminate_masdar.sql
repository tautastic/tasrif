UPDATE morph_pattern
SET rules = JSONB_SET(rules, '{masdar}', TO_JSONB(U&'{1}\064E{2}\0651'::text))
WHERE code = 'f1-a-i-geminate'
  AND rules ->> 'masdar' = U&'{1}\064F{2}\0651';
