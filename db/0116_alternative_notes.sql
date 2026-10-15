UPDATE morph_pattern_alternative
SET note = CASE mood WHEN 'imperative' THEN 'The Wiktionary conjugation tables of اِبْيَضَّ, اِعْوَجَّ and اِسْوَدَّ print the imperative with kasra and uncontracted beside the base form. Wright vol. I §123 says that forms II, V, IX and XI undergo no contraction, and De Goeje''s note there ascribes the uncontracted forms to the dialect of Hijaz and the contracted ones to that of Tamim; the stored form is the first one of the tables and the others are listed as alternatives.' ELSE 'The Wiktionary conjugation tables of اِبْيَضَّ, اِعْوَجَّ and اِسْوَدَّ print the jussive with kasra and uncontracted beside the base form. Wright vol. I §123 says that forms II, V, IX and XI undergo no contraction, and De Goeje''s note there ascribes the uncontracted jussives to the dialect of Hijaz and the contracted ones to that of Tamim; the stored form is the first one of the tables and the others are listed as alternatives.' END
WHERE morph_pattern_id = morph_pattern_id_for_code('f9')
  AND root IS NULL
  AND voice = 'active';

UPDATE morph_pattern_alternative
SET note = 'The Wiktionary conjugation table of كَانَ prints the apocopated jussive (يَكُ) beside يَكُنْ; Wright vol. I §151 rem. says that يَكُنْ is sometimes further abbreviated, especially by the poets, into يَكُ.'
WHERE morph_pattern_id = morph_pattern_id_for_code('f1-a-u-hollow-waw')
  AND root = 'كون'
  AND mood = 'imperfect_jussive';

UPDATE morph_pattern_alternative
SET note = 'The Wiktionary conjugation tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ and اِضْمَحَلَّ print the jussive and the imperative with kasra and uncontracted beside the base form. Wright vol. I §118 inflects form IVq like form IX, and §123 says that form IX undergoes no contraction (De Goeje''s note there ascribes the contracted forms to the dialect of Tamim and the uncontracted ones to that of Hijaz); the stored form is the first one of the tables and the others are listed as alternatives.'
WHERE morph_pattern_id = morph_pattern_id_for_code('f4-quadriliteral')
  AND root IS NULL
  AND voice = 'active';
