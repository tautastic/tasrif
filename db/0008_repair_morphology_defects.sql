UPDATE morph_pattern
SET rules = REPLACE(rules::text, U&'\0639', '{3}')::jsonb
WHERE form_number = 10
  AND description = 'hollow waw'
  AND rules::text LIKE '%' || U&'\0639' || '%';

UPDATE morph_pattern
SET rules = JSONB_SET(rules, '{masdar}', TO_JSONB('{1}' || U&'\064E' || '{2}' || U&'\0652' || '{3}'))
WHERE form_number = 1
  AND description = 'a ~ u, hollow waw'
  AND rules ->> 'masdar' = '{1}{2}{3}';

UPDATE lexical_entry
SET latin_root = transliterate_arabic_root(root)
WHERE latin_root IS DISTINCT FROM transliterate_arabic_root(root);

SELECT regenerate_all_derived_stems();
