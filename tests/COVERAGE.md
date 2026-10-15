# Morphology coverage

What the verb form picker can conjugate, where every expected form comes from, what is deliberately left out, and
what the engine would need for the rest. The machine-checked version of the table below is
[`golden/resolution-matrix.txt`](./golden/resolution-matrix.txt); the expected paradigms are in
[`fixtures/weak-paradigms.ts`](./fixtures/weak-paradigms.ts) (the data split by form into
`weak-paradigms-form-1.ts`, `-forms-2-5.ts` and `-forms-6-10.ts`, each under the formatter's file size limit) and are
asserted by [`paradigm/weak-paradigms.test.ts`](./paradigm/weak-paradigms.test.ts).

## Coverage matrix

`X` resolves to a verified pattern, `x` resolves to a verified pattern that leaves some or all of its verbal nouns
empty (see "Not covered"), `-` does not resolve.
`(seed)` marks a cell that resolved before round 2.

| shape (example) | 1 a~u | 1 a~a | 1 a~i | 1 i~a | 1 i~i | 1 u~u | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sound (كتب) | X seed | X seed | X seed | X seed | X seed | X seed | X seed | X seed | X seed | X seed | X seed | X seed | X seed | X seed | X seed |
| hamzated-first (أمل) | X | X | X | X | - | X | X | X | X | X | X | - | X | - | X |
| hamzated-second (سأل) | X | X | X | X | - | X | X | X | X | X | X | - | X | - | X |
| hamzated-third (قرأ) | X | X | X | X | - | X | X | X | X | X | X | X | X | - | X |
| assimilated-waw (وعد) | - | X | X | X | X | X | X | X | X | X | X | - | X | - | X |
| assimilated-ya (يسر) | - | X | X | X | - | X | X | X | X | X | X | - | X | - | X |
| hollow-waw (قول) | X seed | - | - | X | - | X | X | X | X | X | X | X | X | X | X seed |
| hollow-ya (بيع) | - | - | X seed | X | - | - | X | X | X | X | X | X | X | X | X |
| final-weak-waw (دعو) | X | - | - | X | - | X | X | X | X seed | X | X | X | X seed | - | X seed |
| final-weak-ya (رمي) | - | X seed | X | X | - | - | X | X | X seed | X | X | X | X seed | - | X seed |
| geminate (مدد) | X | - | X seed | X | - | - | X | X | X | X | X | X | X | - | X |
| assimilated-waw + final-weak-ya (وقي) | - | - | X | - | X | - | X | X | X | X | X | - | X | - | X |
| hollow-waw + final-weak-ya (روي) | - | - | X | X | - | - | X | X | X | X | X | X | X | - | X |
| hamzated-first + final-weak-ya (أتي) | - | - | X | - | - | - | X | X | X | X | - | - | - | - | X |
| hamzated-second + final-weak-ya (نأي) | - | X seed | - | - | - | - | - | X | - | - | X | - | X | - | - |
| hollow-ya + hamzated-third (جيء) | - | - | X | X | - | - | X | - | X | X | - | - | - | - | - |
| hollow-waw + hamzated-third (سوء) | X | - | - | - | - | - | - | - | X | X | - | - | X | - | X |
| hollow-ya + final-weak-ya (حيي) | - | - | - | - | - | - | X | - | X | - | - | - | - | - | X |

حَيِيَ itself (form I i ~ a) resolves through an override to the lexical pattern of 0037; the matrix above shows shapes only, which is why the golden `resolution-matrix.txt` shows form I i ~ a as `X` for the sample root حيي: the sample root carries the override.

The empty cells of form I are vowel classes that do not exist for the shape (there is no assimilated a ~ u verb, no
hollow a ~ a verb) or classes that are deliberately not covered (see "Not covered"). In the derived forms an empty
cell is a form the shape does not take or has no table for among the sources (form IX of final-weak and geminate
roots, form VII of assimilated roots) or a form that needs an engine change (see the design proposals below); the
"Not covered" table says which.

The four-radical forms (Iq to IVq) have their own matrix, [`golden/quad-resolution-matrix.txt`](./golden/quad-resolution-matrix.txt):
every four-letter root resolves in all four forms except a root with a final weak radical, which resolves in form IIIq
when the radical is ي and to nothing otherwise (section "B." below).

## Patterns added in round 2

All of them are data: rows of `morph_pattern` and `morph_pattern_resolution` and `lexical_pattern_override` written by
`db/0020`-`db/0037` through the interface in `db/README.md` ("Adding a pattern"). No generator function was changed.
The rows marked "passive" were added in round 3: the passive templates of `db/0061`-`db/0064`, also data, next to the
generator of `db/0060` (proposal C below).

| script | code | shape and class | expected paradigms checked (Wiktionary tables) |
| --- | --- | --- | --- |
| 0020 | `f1-a-u`, `f1-a-a`, `f1-a-i`, `f1-i-a`, `f1-u-u` (seeded) | hamzated-first, resolution rows only | أجر أمل أذن أسر أبق أمن أذن أسف أنس أمن |
| 0020 | `f1-a-u-hamza-elided-in-the-imperative` (lexical) | أكل أخذ أمر, also typed ءكل ءخذ ءمر | أكل أخذ أمر |
| 0021 | `f1-a-i-assimilated-waw` | waw dropped | وعد وصل وزن |
| 0021 | `f1-a-a-assimilated-waw` | waw dropped | وضع وهب وقع |
| 0021 | `f1-i-i-assimilated-waw` | waw dropped | ومق ورث وثق |
| 0021 | `f1-i-a-assimilated-waw` | waw kept, imperative اِي… | وجل وجع وحل |
| 0021 | `f1-u-u-assimilated` | waw or ya kept, imperative اُو…; also resolves ya-first u ~ u | وسم وثق يسر يتم |
| 0021 | `f1-a-i`, `f1-a-a`, `f1-i-a` (seeded) | assimilated-ya, resolution rows only | يتم ينع يبس يقظ |
| 0021 | `f1-i-a-assimilated-waw-waw-elided` (lexical) | وسع | وسع |
| 0022 | `f1-i-a-hollow-waw` | خَافَ يَخَافُ | خاف نام |
| 0022 | `f1-i-a-hollow-ya` | هَابَ يَهَابُ | هاب نال |
| 0022 | `f1-u-u-hollow-waw` | طَالَ يَطُولُ | طال |
| 0023 | `f1-a-i-final-weak` | رَمَى يَرْمِي; also resolves hamzated-first + final-weak-ya | رمى مشى بكى أتى أبى |
| 0023 | `f1-a-u-final-weak-waw` | غَزَا يَغْزُو | غزا دعا عفا |
| 0023 | `f1-i-a-final-weak` | نَسِيَ يَنْسَى | نسي خشي لقي |
| 0023 | `f1-i-a-final-weak-waw` | رَضِيَ يَرْضَى (root رضو) | رضي شقي |
| 0024 | `f1-a-u-geminate` | مَدَّ يَمُدُّ | مد رد ظن |
| 0024 | `f1-i-a-geminate` | عَضَّ يَعَضُّ | عض ظل مس |
| 0025 | `f1-a-i-assimilated-waw-final-weak` | وَقَى يَقِي, قِ | وقى وعى وفى |
| 0025 | `f1-i-i-assimilated-waw-final-weak` | وَلِيَ يَلِي, لِ | ولي |
| 0025 | `f1-a-i-hollow-waw-final-weak` | شَوَى يَشْوِي | شوى طوى روى |
| 0025 | `f1-i-a-hollow-waw-final-weak` | قَوِيَ يَقْوَى | قوي هوي |
| 0026 | `f1-a-a-hamzated-third` (no verbal nouns) | قَرَأَ يَقْرَأُ | بدأ ملأ قرأ |
| 0027 | `f2-final-weak` | سَمَّى يُسَمِّي, masdar تَفْعِلَة; also final-weak-waw and hollow-waw + final-weak-ya | لبى غنى سمى ربى سوى قوى |
| 0027 | `f3-final-weak` | نَادَى يُنَادِي, masdar مُفَاعَاة; also final-weak-waw and hollow-waw + final-weak-ya | نادى ناجى لاقى حاكى داوى ساوى |
| 0027 | `f5-final-weak` | تَمَنَّى يَتَمَنَّى; also final-weak-waw and assimilated-waw + final-weak-ya | تمنى تلقى تحدى تعدى توفى |
| 0027 | `f6-final-weak` | تَلَاقَى يَتَلَاقَى; also final-weak-waw and both lafif shapes | تلاقى تمادى تعالى تداعى توالى تساوى |
| 0027 | `f7-final-weak` | اِنْمَحَى يَنْمَحِي; also final-weak-waw and hollow-waw + final-weak-ya | انمحى انثنى انطوى انزوى |
| 0027 | `f8-assimilated-waw-final-weak` | اِتَّقَى يَتَّقِي | اتقى |
| 0027 | `f10-assimilated-waw-final-weak` | اِسْتَوْلَى, masdar اِسْتِيلَاء | استولى |
| 0027 | `f8-final-weak-ya` (seeded) | hollow-waw + final-weak-ya, resolution row only | استوى ارتوى |
| 0028 | `f2`, `f3`, `f5`, `f6`, `f9` (seeded) | hollow-waw and hollow-ya, resolution rows only: the middle radical is a consonant in these forms (Wright §149) | قوم بين غير; قاوم حاول بايع عاين; تكون تطور تغير; تعاون تزايد تعايش; ابيض اعوج اسود |
| 0028 | `f4-hollow` | أَقَامَ يُقِيمُ, أَقَمْتُ, masdar إِقَامَة; also hollow-ya | أقام أراد أجاب أعاد أشار أفاد أضاف |
| 0028 | `f7-hollow` | اِنْقَادَ يَنْقَادُ, اِنْقَدْتُ, masdar اِنْقِيَاد; also hollow-ya | انقاد انحاز انساق انهار انهال |
| 0028 | `f8-hollow` | اِخْتَارَ يَخْتَارُ, اِخْتَرْتُ, masdar اِخْتِيَار, with the usual assimilation of ت (اِزْدَادَ, اِصْطَادَ); also hollow-ya | احتاج اعتاد ارتاح اجتاز اختار امتاز ابتاع ازداد اصطاد |
| 0028 | `f10-hollow-waw` (seeded) | hollow-ya, resolution row only: the template has no middle radical | استفاد استبان |
| 0029 | `f1-i-a-hollow-waw-strong-inflection` (lexical) | عَوِرَ يَعْوَرُ, حَوِلَ يَحْوَلُ (Wright §160): sound i ~ a templates, masdar فَعَل, the أَفْعَل adjective as active participle, no passive participle | عور حول |
| 0029 | `f8-hollow-strong-inflection` (lexical) | اِزْدَوَجَ, اِجْتَوَرَ (Wright §162): the templates of the seeded `f8` | ازدوج اجتور |
| 0029 | `f10-hollow-strong-inflection` (lexical) | اِسْتَحْوَذَ (Wright §163): the templates of the seeded `f10` | استحوذ |
| 0030 | `f5`, `f6` (seeded) | assimilated-waw and assimilated-ya, resolution rows only: the first radical is a consonant in these forms | توقع توجه توقف توصل تيسر; تواصل توافق تياسر |
| 0030 | `f2`, `f3`, `f10` (seeded) | assimilated-ya, resolution rows only (Wright §146); in form X the ِيْ → ِي normalisation gives the masdar اِسْتِيقَاظ | يسر ياسر استيقظ |
| 0030 | `f8-assimilated-waw` | اِتَّصَلَ يَتَّصِلُ, masdar اِتِّصَال (Wright §148); the template has no first radical and also serves ya-first roots (اِتَّسَرَ) | اتصل اتفق اتحد اتجه اتزن اتسر |
| 0030 | `f10-assimilated-waw` | اِسْتَوْرَدَ يَسْتَوْرِدُ, masdar اِسْتِيرَاد (Wright §145) | استورد استوعب استوطن استوجب |
| 0031 | `f2`, `f5` (seeded) | geminate, resolution rows only: the doubled radical cannot contract in these forms (Wright §123) | حدد قرر; تقرر تجدد تمدد |
| 0031 | `f3-geminate` | حَاجَّ يُحَاجُّ, حَاجَجْتُ, masdar مُحَاجَّة (Wright §§123-124) | حاج شاق ضاد ماس |
| 0031 | `f4-geminate` | أَحَبَّ يُحِبُّ, أَحْبَبْتُ, masdar إِفْعَال (إِعْدَاد) | أحب أعد أصر أحس أتم أقر |
| 0031 | `f6-geminate` | تَحَاجَّ يَتَحَاجُّ, masdar تَحَاجّ (Wright §124) | تحاج تماس |
| 0031 | `f7-geminate` | اِنْشَقَّ يَنْشَقُّ, اِنْشَقَقْتُ | انشق انضم انحل |
| 0031 | `f8-geminate` | اِمْتَدَّ يَمْتَدُّ, اِمْتَدَدْتُ, with the usual assimilation of ت (اِضْطَرَّ) | امتد احتل اهتم ارتد اضطر |
| 0031 | `f10-geminate` | اِسْتَمَرَّ يَسْتَمِرُّ, اِسْتَمْرَرْتُ, masdar اِسْتِمْرَار | استمر استعد استقل استحق استغل |
| 0032 | `f5`, `f6` (seeded) | hamzated-first, resolution rows only: the hamza always follows fatha (تَأَكَّدَ, تَآمَرَ) | تأكد تأخر تأثر تأمل; تآمر تآلف تآكل |
| 0032 | `f10-hamzated-first` (no masdar) | اِسْتَأْذَنَ يَسْتَأْذِنُ, the templates of the seeded `f10` without the masdar اِسْتِئْذَان | استأذن استأنف استأجر استأثر |
| 0032 | `f5-hamzated-third`, `f6-hamzated-third` (no masdar, no active participle) | تَنَبَّأَ يَتَنَبَّأُ, تَبَاطَأَ يَتَبَاطَأُ; the passive participle مُتَنَبَّأ is generated | تنبأ; تباطأ تكافأ تفاجأ |
| 0033 | `f4-final-weak-ya`, `f10-final-weak-ya` (seeded), `f5-final-weak` | hollow-waw + final-weak-ya in forms IV, V and X and hamzated-first + final-weak-ya in form V, resolution rows only (Wright §179: the middle و stays a consonant; the first-radical hamza follows fatha) | أغوى أهوى أقوى; تقوى تأتى; استهوى استقوى |
| 0034 | `f3`, `f6` (seeded) | hamzated-second, resolution rows only: the hamza always follows the long ā and the engine seats it by its own vowel whatever the typed letter (سَاءَلَ يُسَائِلُ مُسَاءَلَة, تَسَاءَلَ تَسَاؤُل مُتَسَائِل) | ساءل لاءم; تساءل تفاءل تشاءم تثاءب |
| 0034 | `f5-hamzated-second` (no masdar, no active participle) | تَرَأَّسَ يَتَرَأَّسُ: the hamza has fatha in every finite form; the passive participle مُتَرَأَّس is generated | ترأس ترأف |
| 0035 | `f8-hamza-assimilated` (lexical) | اِتَّخَذَ يَتَّخِذُ (Wright §139), the templates of `f8-assimilated-waw`; overrides أخذ and ءخذ | اتخذ |
| 0035 | `f4-final-weak-hamzated-middle-hamza-elided` (lexical) | أَرَى يُرِي, masdar إِرَاءَة (Wright §176), the form IV final-weak templates without the hamza; overrides رأي and رءي | أرى |
| 0036 | `f2-hollow-ya-final-weak`, `f4-hollow-ya-final-weak`, `f10-hollow-ya-final-weak` | حَيَّا يُحَيِّي (masdar تَحِيَّة), أَحْيَا يُحْيِي, اِسْتَحْيَا يَسْتَحْيِي: the final-weak templates with the final ā written with alif after ي (Wright §179 rem. a) | حيا; أحيا أعيا; استحيا |
| 0037 | `f1-i-a-hollow-ya-final-weak` (lexical) | حَيِيَ يَحْيَا, 3rd plural حَيُّوا, masdar حَيَاة, no participles (Wright §179 rem. a, b); override حيي | حيي |
| 0050 | `f1-a-i-geminate` (seeded) | masdar repaired to فَعْل (فَرّ, شَدّ) | فرّ شدّ |
| 0052 | `f2`, `f3` (seeded) | assimilated-waw, resolution rows only: the 1st singular imperfect keeps its alif seat (أُوَحِّدُ, أُوَاصِلُ) now that `0051` anchors the rewrites | وحد وصل |
| 0052 | `f4-assimilated` | أَوْجَدَ يُوجِدُ and أَيْقَظَ يُوقِظُ: perfect أَ{1}ْ{2}َ{3}, imperfect stem و{2}ِ{3}, masdar إِي{2}َا{3} (Wright §§145, 147) | وجد يقظ |
| 0052 | `f4-assimilated-waw-final-weak` | أَوْفَى يُوفِي, masdar إِيفَاء | وفي |
| 0054 | none (engine) | every hamza radical is a bare hamza and `normalize_arabic_hamza_seating_bare` seats it by Wright §§131-135 | see "Hamza canonicalisation" |
| 0055 | `f1-a-u`, `f1-a-a`, `f1-a-i`, `f1-i-a`, `f1-u-u` (seeded) | hamzated-second and hamzated-third, resolution rows only (the sound templates serve them): دأب سأل زأر سئم بؤس; هنأ برأ جرؤ | دأب رأس رأف زأر سأل سئم بئس بؤس ضؤل; هنأ ظمئ خطئ صدئ بطؤ جرؤ |
| 0055 | `f2`, `f3`, `f4`, `f7`, `f8`, `f10` (seeded) | hamzated-first (II أَكَّدَ, III آخَذَ, IV آمَنَ, VIII اِئْتَلَفَ), hamzated-second (II رَأَّسَ), hamzated-third (II هَنَّأَ, III فَاجَأَ, IV أَنْشَأَ, VII اِنْطَفَأَ, VIII اِبْتَدَأَ, X اِسْتَهْزَأَ), resolution rows only | أكد آخذ آكل ائتلف ائتمر أمن; رأس; هنأ فاجأ أنشأ أقرأ انطفأ ابتدأ استهزأ |
| 0055 | `f1-a-a-hamzated-third`, `f5-hamzated-second`, `f5-hamzated-third`, `f6-hamzated-third`, `f10-hamzated-first` | the masdar and active participle they omitted are copied from the sound pattern they mirror | قرأ بدأ ملأ; ترأس; تنبأ; تباطأ تكافأ تفاجأ; استأذن |
| 0055 | `f1-a-i-hollow-ya-hamzated-third`, `f1-i-a-hollow-ya-hamzated-third`, `f1-a-u-hollow-waw-hamzated-third` | جَاءَ يَجِيءُ, شَاءَ يَشَاءُ, سَاءَ يَسُوءُ, نَاءَ يَنُوءُ: the hollow templates with the active participle `{1}َا{3}ٍ` (جَاءٍ) | جاء شاء ساء ناء |
| 0061 | `f1-a-u`, `f1-a-i`, `f1-a-a`, `f1-i-a`, `f1-i-i`, `f1-a-a-hamzated-third` (passive) | passive perfect `{1}ُ{2}ِ{3}`, stem `{1}ْ{2}َ{3}` for the sound, hamzated-first, -second and -third shapes (كُتِبَ يُكْتَبُ, أُجِرَ يُؤْجَرُ, بُدِئَ يُبْدَأُ; Wright §§100-101) | أجر أمل هنأ كتب; أسر هنأ ضرب; أذن سأل رأس فتح; أمن سئم شرب; حسب; بدأ ملأ قرأ |
| 0061 | `f1-a-u-hamza-elided-in-the-imperative` (lexical, passive) | the sound templates: أُكِلَ يُؤْكَلُ, the imperative elision does not reach the passive | أكل أخذ أمر |
| 0061 | `f1-a-i-assimilated-waw`, `f1-a-a-assimilated-waw`, `f1-i-i-assimilated-waw`, `f1-i-a-assimilated-waw`, `f1-i-a-assimilated-waw-waw-elided` (passive) | the waw is kept after damma: وُعِدَ يُوعَدُ (Wright §145) | وعد وصل وزن; وضع وهب; ومق ورث; وجع; وسع |
| 0061 | `f2`, `f3`, `f4`, `f5`, `f6`, `f8`, `f10` (seeded, passive) | passive of the derived forms, sound shapes and every shape that reaches the same templates: II كُتِّبَ يُكَتَّبُ, III قُوتِلَ يُقَاتَلُ, IV أُرْسِلَ, V تُعُلِّمَ, VI تُبُودِلَ, VIII اُحْتُرِمَ, X اُسْتُخْرِجَ يُسْتَخْرَجُ; ya-first roots take the waw (يُسِّرَ يُيَسَّرُ in II, اُسْتُوقِظَ يُسْتَيْقَظُ in X, Wright §147) | قوم بين غير يسر وحد حدد قرر رأس هنأ أكد كتب; قاوم حاول بايع عاين ياسر واصل ساءل لاءم آخذ فاجأ قاتل; أنشأ أقرأ آكل أرسل; توقع تأثر تأمل تعلم; تياسر تبادل; ائتلف ارتكب احترم; استيقظ استخرج استعمل |
| 0061 | `f4-assimilated` (passive) | أُوجِدَ يُوجَدُ and أُوقِظَ يُوقَظُ (Wright §§145, 147) | أوجد أيقظ |
| 0061 | `f5-hamzated-second`, `f5-hamzated-third` (passive) | تُرُئِّسَ يُتَرَأَّسُ; for `f5-hamzated-third` (تُنُبِّئَ يُتَنَبَّأُ) only the impersonal third masculine singular of تنبأ is tabled and pinned | ترأس; تنبأ (impersonal) |
| 0061 | `f8-assimilated-waw`, `f8-hamza-assimilated`, `f10-assimilated-waw`, `f10-hamzated-first` (passive) | اُتُّسِرَ يُتَّسَرُ, اُتُّخِذَ يُتَّخَذُ, اُسْتُورِدَ يُسْتَوْرَدُ, اُسْتُؤْذِنَ يُسْتَأْذَنُ | اتسر; اتخذ; استورد استوعب استوطن استوجب; استأذن استأنف استأجر |
| 0062 | `f1-a-u-hollow-waw`, `f1-i-a-hollow-waw`, `f1-a-i-hollow-ya`, `f1-i-a-hollow-ya` (passive) | long stem with ī and short stem with kasra: نِيلَ / نِلْتُ, بِيعَ / بِعْتُ, imperfect يُنَالُ يُبَاعُ (Wright §§154, 156) | نال; خاف; هاب زال باع; هاب نال |
| 0062 | `f1-a-i-hollow-ya-hamzated-third`, `f1-i-a-hollow-ya-hamzated-third`, `f1-a-u-hollow-waw-hamzated-third` (passive) | جِيءَ يُجَاءُ, شِيءَ يُشَاءُ, سِيءَ يُسَاءُ | جاء; شاء; ساء ناء |
| 0062 | `f4-hollow`, `f8-hollow`, `f10-hollow-waw` (passive) | أُقِيمَ يُقَامُ, اُحْتِيجَ يُحْتَاجُ, اُسْتُقِيمَ يُسْتَقَامُ; also hollow-ya | أقام أراد أجاب أعاد أشار أفاد أضاف; احتاج اعتاد اجتاز اختار ابتاع اصطاد; استقام استطاع استجاب استفاد استبان |
| 0063 | `f1-a-i-final-weak`, `f1-i-a-final-weak`, `f1-a-a-final-weak`, `f1-a-u-final-weak-waw`, `f1-i-a-final-weak-waw` (passive) | the defective passive with ya: رُمِيَ يُرْمَى, غُزِيَ يُغْزَى, نُسِيَ يُنْسَى (Wright §169) | رمى بكى أتى أبى; نسي لقي; رعى; غزا دعا عفا; رضي شقي |
| 0063 | `f1-a-i-assimilated-waw-final-weak`, `f1-i-i-assimilated-waw-final-weak`, `f1-a-i-hollow-waw-final-weak`, `f1-i-a-hollow-waw-final-weak` (passive) | وُقِيَ يُوقَى, وُلِيَ يُولَى, شُوِيَ يُشْوَى, هُوِيَ يُهْوَى (Wright §§171-179) | وقى وعى; ولي; شوى طوى روى; هوي |
| 0063 | `f1-a-a-final-weak-hamzated-middle`, `f1-a-a-final-weak-hamzated-middle-hamza-elided` (lexical, passive) | نُئِيَ يُنْأَى and رُئِيَ يُرَى | نأى; رأى |
| 0063 | `f2-final-weak`, `f3-final-weak`, `f5-final-weak` (passive) | لُبِّيَ يُلَبَّى, نُودِيَ يُنَادَى, تُمُنِّيَ يُتَمَنَّى; also final-weak-waw and the doubly weak shapes they serve | لبى غنى سمى ربى سوى قوى; نادى ناجى لاقى حاكى داوى ساوى; تمنى تعدى توفى |
| 0063 | `f4-final-weak-ya`, `f4-final-weak-waw`, `f4-assimilated-waw-final-weak`, `f4-final-weak-hamzated-middle-hamza-elided` (lexical, passive) | أُبْقِيَ يُبْقَى, أُعْطِيَ يُعْطَى, أُوفِيَ يُوفَى, أُرِيَ يُرَى | أبقى ألقى أغوى أهوى; أعطى; أوفى; أرى |
| 0063 | `f8-final-weak-ya`, `f8-final-weak-waw`, `f8-assimilated-waw-final-weak`, `f10-final-weak-ya`, `f10-final-weak-waw` (passive) | اُشْتُرِيَ يُشْتَرَى, اُتُّقِيَ يُتَّقَى, اُسْتُهْوِيَ يُسْتَهْوَى; `f8-final-weak-waw` and `f10-final-weak-waw` have no table and carry the templates of their ya twins, which `integration/passive-pattern-data.test.ts` asserts (Wright §169) | اشترى اكتفى; اتقى; استهوى |
| 0063 | `f2-hollow-ya-final-weak`, `f4-hollow-ya-final-weak`, `f10-hollow-ya-final-weak` (passive) | the final ā written with alif after ya: حُيِّيَ يُحَيَّا, أُحْيِيَ يُحْيَا, اُسْتُحْيِيَ يُسْتَحْيَا (Wright §179 rem. a) | حيا; أحيا أعيا; استحيا |
| 0064 | `f1-a-u-geminate`, `f1-i-a-geminate`, `f1-a-i-geminate` (passive) | contracted third persons, uncontracted first and second: مُدَّ يُمَدُّ, مُدِدْتُ, عُضَّ يُعَضُّ, حُبَّ يُحَبُّ (Wright §§119-123) | مد رد ظن; عض مس; حب |
| 0064 | `f3-geminate`, `f4-geminate`, `f8-geminate`, `f10-geminate` (passive) | حُوجَّ يُحَاجُّ, أُحِبَّ يُحَبُّ, اُحْتُلَّ يُحْتَلُّ, اُسْتُمِرَّ يُسْتَمَرُّ | حاج شاق ضاد ماس; أحب أعد أصر أحس أتم أقر; احتل اضطر; استمر استعد استقل استحق استغل |

The seeded patterns that were already reachable were checked the same way and need no change, except one defect
listed under "Defects found in seeded data": `f1-a-u-hollow-waw` (زال نال, and قال in `paradigms.ts`),
`f1-a-i-hollow-ya` (هاب زال باع), `f1-a-i-geminate` (فرّ شدّ), `f1-a-a-final-weak` (رعى, and سعى),
`f4-final-weak-ya` (أبقى ألقى), `f4-final-weak-waw` (أعطى), `f8-final-weak-ya` (اشترى اكتفى),
`f10-hollow-waw` (استقام استطاع استجاب).

## Patterns and resolution rows added in round 3

Also data only (`db/0110`-`db/0115`, no function changed). Every fixture was written from the Wiktionary table first and
compared with the engine cell by cell afterwards; in each group below the existing templates were right, except the one
new pattern (0114).

| script | code | shape and class | expected paradigms checked (Wiktionary tables) |
| --- | --- | --- | --- |
| 0110 | `f4`, `f8`, `f10` (seeded) | hamzated-second, resolution rows only: IV أَسْأَمَ يُسْئِمُ (masdar إِسْآم), VIII اِكْتَأَبَ يَكْتَئِبُ, X اِسْتَسْأَلَ يَسْتَسْئِلُ (masdar اِسْتِسْآل); the hamza follows the sukun of the first radical | أسأم; اكتأب ابتأس; استسأل |
| 0111 | `f2`, `f5`, `f4-hollow`, `f8-hollow`, `f10-hollow-waw` (seeded) | hollow-waw and hollow-ya + hamzated-third, resolution rows only: II هَيَّأَ, V تَهَيَّأَ (Wright §149, the middle radical is a consonant), IV أَسَاءَ يُسِيءُ أَسَأْتُ, VIII اِسْتَاءَ, X اِسْتَضَاءَ (§§150-153, with the hamza of §174 seated by §§131-134) | هيأ شيأ; تشيأ تبوأ; أساء أضاء أفاء; استاء; استضاء |
| 0112 | `f2-final-weak`, `f3-final-weak`, `f4-final-weak-ya`, `f6-final-weak`, `f8-final-weak-ya` (seeded) | assimilated-waw + final-weak-ya II وَفَّى and III وَافَى (Wright §178), hamzated-first + final-weak-ya II أَدَّى, III آتَى and IV آتَى آذَى (§175), hamzated-second + final-weak-ya III رَاءَى, VI تَرَاءَى تَنَاءَى and VIII اِرْتَأَى اِنْتَأَى (§175), resolution rows only | وفى ولى وصى; وافى واسى وازى; أدى آتى آذى; راءى تراءى تناءى ارتأى انتأى |
| 0113 | override rows to `f1-i-a-hollow-waw-strong-inflection` (lexical) | حَوِرَ يَحْوَرُ, غَيِدَ يَغْيَدُ, هَيِفَ يَهْيَفُ (Wright §160): the sound i ~ a templates, masdar فَعَل, the أَفْعَل adjective as active participle, no passive participle; غيد and هيف are hollow-ya | حور غيد هيف |
| 0114 | `f1-u-u-final-weak-waw` | رَخُوَ يَرْخُو (Wright §164, fifth kind): perfect رَخُوَ رَخُوتُ رَخُوا, the imperfect and imperative of `f1-a-u-final-weak-waw`; no masdar and no participles (see "Conventions") | رخو |
| 0115 | `f10-final-weak-ya` (seeded) | hamzated-first + final-weak-ya, form X اِسْتَأْتَى يَسْتَأْتِي (masdar اِسْتِئْتَاء), resolution row only | استأتى |

Where a table gives alternatives for the seat of a hamza, the fixture takes the spelling of the seat table in
"Hamza canonicalisation" (Wright §133): ؤ for a hamza with damma after the long ā (أَسَاؤُوا, يُرَاؤُونَ), ئ after the long ī
(تُسِيئُونَ), and, for a hamza that ends the word, the seat of the vowel before it alone (the jussive يُرَاءِ, يَرْتَأِ, the
imperative رَاءِ, the participle مُرَاءٍ, the masdar تَرَاءٍ), where the tables also print the older seats (رَائِ, يَرْتَئِ,
مُرَائٍ).

## Cells sourced from new Wiktionary roots (round 3, `db/0118`-`db/0121`)

The categories of Wiktionary for each class of "Not covered" were listed on 2026-10-15 (for example `Category:Arabic
form-VII verbs with ء as first radical`, `Category:Arabic form-IX verbs with ء as second radical`, `Category:Arabic hollow
form-VII verbs`) and every verb they hold was fetched, with the revision of its page in the `source` of its fixture. Each table was
compared with the engine cell by cell before any row was written. The first four groups need no new template: the engine already
produced all 57 finite cells of every table, so they are resolution rows. The last three need a pattern each, written from the
patterns that already hold the templates (`INSERT … SELECT` of their rules), and the cells were compared again.

| script | code | shape and class | expected paradigms checked (Wiktionary tables) |
| --- | --- | --- | --- |
| 0118 | `f3`, `f6` (seeded) | hollow-waw and hollow-ya + hamzated-third, forms III and VI, resolution rows only (Wright §149, §159, §§131-134): نَاوَأَ يُنَاوِئُ and هَايَأَ يُهَايِئُ with their full passive (`passive-paradigms-forms-2-5.ts`), تَنَاوَأَ without a passive and تَهَايَأَ with an impersonal one (`passive-absent.ts`) | ناوأ هايأ; تناوأ تهايأ |
| 0118 | `f7` (seeded) | hamzated-second and hamzated-first, form VII, resolution rows only: اِنْذَأَفَ يَنْذَئِفُ (masdar اِنْذِئَاف) and اِنْأَطَرَ يَنْأَطِرُ (masdar اِنْئِطَار, the first-radical hamza after the closed syllable of the ن, Wright §134) | انذأف; انأطر |
| 0118 | `f9` (seeded) | hamzated-second, form IX, resolution row only: اِجْأَلَّ يَجْأَلُّ (masdar اِجْئِلَال); the table prints the three jussive and imperative spellings of the other form IX tables, which `f9` already lists as alternatives | اجأل |
| 0118 | `f7-final-weak`, `f7-hollow` (seeded) | hamzated-second + final-weak-ya, form VII: اِنْفَأَى يَنْفَئِي (masdar اِنْفِئَاء); hamzated-first + hollow-waw, form VII, a new shape (`hamzated-first-hollow-waw`, sample root أود): اِنْآدَ يَنْآدُ اِنْأَدْتُ (masdar اِنْئِيَاد, the hamza and the alif written آ, Wright §135) | انفأى; انآد |
| 0119 | `f1-u-u-geminate` | geminate u ~ u: حَبُبْتُ حَبَّ حَبُّوا يَحُبُّ, the perfect of `f1-u-u` and the contraction of `f1-a-u-geminate`, whose twelve active alternatives it copies; no passive, no masdar (the three tables print حُبّ, شَرَارَة, ضَرَارَة) and no passive participle; the active participle is the `f1-u-u` one (ضَرِير is printed) | حب شر ضر |
| 0120 | `f1-a-a-final-weak-waw` | final-weak-waw a ~ a: عَشَوْتُ عَشَا يَعْشَى, the perfect, the passive and the passive participle (مَعْشُوّ) of `f1-a-u-final-weak-waw` with the imperfect and the imperative of `f1-i-a-final-weak-waw`; no masdar (the tables print عَشَاء and صَهْي) | عشا صها |
| 0121 | `f1-a-a-final-weak-hamzated-first`, `f1-a-i-hollow-waw-final-weak-hamzated-first` (lexical) | أَبَى يَأْبَى (masdar إِبَاء; the table also prints إِبَاءَة) and أَوَى يَأْوِي (masdar إِوِيّ; the table also prints أُوِيّ and إِوَاء), the templates of `f1-a-a-final-weak` and `f1-a-i-hollow-waw-final-weak` with a masdar of their own; the further nouns are rows of `morph_pattern_alternative_noun` | أبى أوى |

Where the tables print more than one form for a cell of these verbs, the fixture takes the first and the data ships the rest
as alternatives wherever the table and Wright agree: the three jussive spellings of the geminate u ~ u verbs and of اِجْأَلَّ
(`alternatives-cells.ts`), the further verbal nouns of أَبَى and أَوَى. It does not ship the three seats of the final hamza that
the table of اِنْفَأَى prints in the jussive, the imperative of the masculine singular and the active participle (يَنْفَأِ,
يَنْفَئِ, يَنْفَإِ; مُنْفَأٍ, مُنْفَئٍ, مُنْفَإٍ). The primary form follows the fixtures of the other hamzated-second final-weak
forms (a final hamza is seated by the vowel before it alone, the seat of يَرْتَأِ and مُرْتَأٍ), whereas Wright §133 seats a
hamza with kasra after fatha on ya (يَنْفَئِ): which of the two is the primary form is an open question for the maintainers,
and the cells are recorded as `shipped: false` with that reason.

## Sources

Every fixture row names its sources in its `source` field. The finite forms (13 persons of the perfect and of the
indicative, subjunctive and jussive, 5 imperative persons) are transcribed from the Wiktionary conjugation table of the
verb (Module:ar-verb output, CC BY-SA 4.0); the fixture records the page and revision. Each paradigm is tied to the
section of W. Wright, *A Grammar of the Arabic Language*, 3rd ed. (Cambridge 1896), vol. I that states its rule:

| topic | Wright vol. I |
| --- | --- |
| geminate verbs: contraction, jussive and imperative alternatives; contraction in forms III, IV, VI, VII, VIII and X, none in II, V and IX (§123), the long ā of III and VI (§124), the derived jussive (§125) | §§119-125 |
| hamza: seats, آ for أَأْ and أَا, the imperatives كُلْ خُذْ مُرْ, سَلْ | §§130-140 |
| first radical و or ي: dropped with kasra (and in the eight verbs of §142 rem. a and §144), kept otherwise | §§141-148 |
| hollow verbs: shortening, perfect vowels of فَعَلَ / فَعُلَ / فَعِلَ, the fa'ila verbs with fatha imperfect; strong in forms II, III, V, VI and IX (§149), weak in IV, VII, VIII and X (§§150-153) | §§149-163 |
| defective verbs: the five kinds, contraction, passive participle | §§164-170 |
| doubly weak verbs: hamza + weak, و…ي (وَقَى), …وي (شَوَى, قَوِيَ) | §§171-179 |

The vendored appendix (`src/content/appendix/arabic-verbs.json`) contributes the form I participle patterns فَاعِل and
مَفْعُول, the form X notes on weak roots (hollow roots take ـِي in the imperfect stem), the form V and IX example verbs
(تَغَيَّرَ, تَطَوَّرَ, اِبْيَضَّ, اِعْوَجَّ), the absence of a form IX passive participle and the form VIII assimilation of
ت; it has no weak-verb tables.

Where a table gives alternatives the fixture takes one and says which:

- hamzated-first imperatives use the seat spelling of the tables (اُؤْمُلْ, اِئْذَنْ); Wright §132 rem. b gives the
  older أُومُلْ, إِيذَنْ. The engine's normalisation produces the first.
- أَمَرَ: the table gives مُرْ and اُؤْمُرْ; the fixture and the lexical pattern take مُرْ (Wright §137).
- geminate verbs: the jussive singular and 1st plural and the 2ms imperative have three forms (يَمُدَّ / يَمُدِّ /
  يَمْدُدْ, مُدَّ / مُدِّ / اُمْدُدْ). The new patterns take what the seeded a ~ i geminate pattern takes: the jussive
  contracted with fatha and the 2ms imperative uncontracted.
- geminate derived forms take the same two choices (jussive يُحِبَّ, يَسْتَمِرَّ; imperative 2ms أَحْبِبْ, اِسْتَمْرِرْ).
  The form X tables also give analogical 1st and 2nd persons of the perfect in ـَّيْتُ (اِسْتَمَرَّيْتُ beside
  اِسْتَمْرَرْتُ); the fixtures and `f10-geminate` take the classical uncontracted form, the only one the tables of the
  other forms print.
- final-weak i ~ a with final و: passive participle مَرْضِيّ (Wright §170: far more common than مَرْضُوّ).
- hamzated-third: 3rd plural قَرَؤُوا, يَقْرَؤُونَ, the spelling of the tables (يَقْرَأُونَ is also in use).
- form IX (اِبْيَضَّ, اِعْوَجَّ, اِسْوَدَّ): the jussive singular and 1st plural and the 2ms imperative have three forms
  (يَبْيَضَّ / يَبْيَضِّ / يَبْيَضِضْ); the fixtures take the first, which is what the seeded form IX pattern produces.

## Conventions the new patterns follow

- **Form I masdar.** Every seeded form I pattern carries a schematic masdar, فَعْل (فُعْل for u ~ u), not the verb's
  lexical masdar, which entries supply through `masdar_override`. The new patterns keep that convention when the
  schematic form is attested as a real masdar of at least one verb the pattern serves (وَعْد, وَضْع, وَمْق, يَبْس,
  يُسْر, خَوْف, هَيْب, طُول, رَمْي, غَزْو, نَسْي, مَدّ, عَضّ, وَقْي, وَلْي, شَيّ, أَتْي, and أَجْر أَسْر أَذْن
  أَمْن أُنْس for the hamzated-first rows of the seeded patterns). When it is not, the pattern has **no masdar**
  (NULL), so an admin sees an empty cell instead of an invented word:
  `f1-i-a-assimilated-waw` (would be وَجْل), `f1-i-a-final-weak-waw` (رَضْو), `f1-i-a-hollow-waw-final-weak` (قَيّ), `f1-u-u-final-weak-waw` (رُخْو: the table prints رَخَاوَة and رَخَاء).
  The lexical `f1-i-a-assimilated-waw-waw-elided` carries its verb's own masdar سَعَة, and the lexical
  `f1-i-a-hollow-waw-strong-inflection` the فَعَل of both its verbs (عَوَر, حَوَل).
- **Participles.** فَاعِل and مَفْعُول for every class except u ~ u (and `f1-u-u-final-weak-waw`, whose table prints no participle, so the pattern has none), which follows the seeded u ~ u pattern (فَعِيل,
  e.g. أَنِيس, وَسِيم, طَوِيل, يَسِير), and the two verbs of bodily defect of 0029, whose tables give the أَفْعَل
  adjective (أَعْوَر, أَحْوَل) and no passive.
- **Hamza radicals** are always written as their placeholder (the invariant in
  `invariants/pattern-data.test.ts`), so the output depends on how the radical was typed; see below.
- **Shared patterns.** A shape whose paradigm is literally that of another shape resolves to the same pattern
  (`add_morph_pattern_resolution`) instead of a copy: hamzated-first and ya-first roots use the sound patterns,
  ya-first u ~ u uses the waw-first `f1-u-u-assimilated`, hamzated-first + final-weak uses `f1-a-i-final-weak`,
  hamzated-first roots use the sound patterns of forms V and VI, hamzated-second roots those of forms III and VI,
  hollow roots use the sound patterns of forms II, III, V, VI and IX, and the hollow patterns of forms IV, VII, VIII and X
  (whose templates have no middle radical) serve middle و and middle ي alike; waw-first roots use the sound patterns
  of forms V and VI, ya-first roots those of forms II, III, V, VI and X, and the form VIII pattern of waw-first roots
  (which has no first radical) serves ya-first roots too; geminate roots use the sound patterns of forms II and V; the doubly weak roots of 0027 and 0033 use the
  final-weak patterns of their form.
- **Derived-form participles.** Every seeded derived pattern has a passive participle, and so have the new ones. When
  the verb's table has no passive (تَكَوَّنَ, تَطَوَّرَ, اِنْهَارَ, اِنْهَالَ, اِنْمَحَى), the fixture expects the regular
  form the pattern produces for every verb of the class and says so in its `source`; `morphology_overrides.no_passive`
  is how an entry drops it.

## Not covered, and why

| what | why | status |
| --- | --- | --- |
| hamzated-first form IX, hamzated-third form IX | the categories `Arabic form-IX verbs with ء as first radical` and `… as third radical` are empty (2026-10-15); pages tried earlier: انأكل, انأسر (no page). Form VII of hamzated-first and hamzated-second roots and form IX of hamzated-second roots are covered by 0118 (IV, VIII and X of hamzated-second by 0110; pages tried before: انسأ an entry without a table, انجأر no page) | not covered |
| hollow + hamzated-third in forms VII and IX, hollow-waw form II, hollow-ya forms VIII and X (أَجَاءَ, أَشَاءَ), hollow-ya a ~ a, hollow-waw i ~ a and u ~ u with a hamza | forms II, IV, V, VIII and X are covered by 0111, forms III and VI by 0118. The category `Arabic hollow form-VII verbs` holds fourteen verbs and none has a hamza as third radical, `Arabic hollow form-IX verbs` is empty (2026-10-15). Pages tried: أجاء أشاء (entries without a table), استفاء استجاء بوأ سوأ (no page); form I: ضاء باء (a ~ u), فاء (a ~ i), هاء (i ~ a) are the classes already covered | not covered |
| the active participle of سَاءَ (سَيِّئ) | the participle of this verb is the adjective, the pattern gives the regular سَاءٍ | recorded as an engine deviation in `form-1-a-u-hollow-waw-hamzated-third-swa` |
| hollow-ya u ~ u, assimilated a ~ u | do not occur (Wright §§157, 142-144) | nothing to cover |
| وَطِئَ يَطَأُ, وَسِعَ's sibling exceptions of §144 other than وَسِعَ | وَطِئَ is also hamzated-third; the rest of the §144 list is a ~ a (وَضَعَ, وَقَعَ, وَهَبَ, وَدَعَ …) and covered by the shape pattern | وطئ not covered |
| عَيِيَ in form I, and the other derived forms of the حيي class | no table among the sources (حَيِيَ has one and is covered by 0037; its alternative contracted perfect حَيَّ, Wright §179 rem. b, is not produced) | not covered |
| doubly weak roots in the remaining derived forms: hamzated-first + final-weak-ya VIII (اِئْتَلَى), VI and VII; hamzated-second + final-weak-ya V, IX and X | assimilated-waw + final-weak-ya II, III, IV, hamzated-first + final-weak-ya II, III, IV, X and hamzated-second + final-weak-ya III, VI, VII, VIII are covered by 0052, 0112, 0115 and 0118 (the irregular أَرَى has its own lexical pattern). Pages tried for form VIII: ائتلى ائتمى ائتسى (no page) | the rest is not covered |
| form VII of assimilated roots, form IX of assimilated and geminate roots | the categories `Arabic assimilated form-VII verbs`, `Arabic assimilated form-IX verbs`, `Arabic geminate form-IX verbs` and `Arabic form-VII verbs with و as first radical` / `ي as first radical` are empty (2026-10-15); pages tried: انوجد انوصل انوعد (no page); the appendix lists no such verb | not covered |
| other hollow verbs inflected as strong verbs: the rest of Wright's lists in §§160-163 (عَوِجَ, صَيِدَ, اِسْتَنْوَقَ …) and the strong alternatives of form IV (أَغْيَمَ beside أَغَامَ, §161) | single verbs without a table among the sources; the eight verbs that have one (عَوِرَ, حَوِلَ, اِزْدَوَجَ, اِجْتَوَرَ, اِسْتَحْوَذَ in 0029, حَوِرَ, غَيِدَ, هَيِفَ in 0113) are covered; the page صيد has no verb table and عوج has form II only | not covered; an override row per verb to the 0029 patterns covers each |
| a second verb of one root, form and vowel class with its own inflection, other than جوب form X | variants (section G) make it one `lexical_pattern_override` row with a `variant` name, so the engine can hold it; only اِسْتَجَابَ / اِسْتَجْوَبَ (Wright §163) ships, because its table is in the sources. Any other pair needs the table of the second verb and a lexical pattern when no existing one serves it | covered for جوب; other pairs not covered |
| the other seats of the final hamza in the jussive, the imperative and the active participle of the final-weak hamzated-second verbs (يَنْفَئِ and يَنْفَإِ beside يَنْفَأِ, يَرْتَئِ beside يَرْتَأِ) | the tables print them; the primary form follows the seat of the vowel before the hamza and Wright §133 seats a hamza with kasra after fatha on ya, so the choice of the primary is open (see the section above) | not shipped; recorded with `shipped: false` for اِنْفَأَى |

### Cells without a source

None of the shipped cells is unsourced: every finite cell of every fixture is in a Wiktionary table. The schematic
masdars and participles that are not the verb's lexical form are marked as such in the fixture's `source` and in the
"Conventions" section; the masdars the sources do not support are omitted (NULL), not guessed.

## Sweep

[`paradigm/weak-sweep.test.ts`](./paradigm/weak-sweep.test.ts) runs real roots of every covered shape
([`fixtures/sweep-roots.ts`](./fixtures/sweep-roots.ts)) through every verb form choice that resolves for them and checks
the structural invariants (every person present, no placeholder residue, no stacked vowels, no doubled shadda or shadda
with sukun, no unvocalised letter, letter count bounds), that a stored entry gets exactly the forms and verbal nouns the
pattern preview computes from the same rules, and that a hamza radical gives the same paradigm whichever of ء أ إ آ ؤ ئ
the root was typed with.

| shape | roots swept |
| --- | --- |
| hamzated-first | 26 (every resolving choice, forms II to VI, VIII and X included) |
| hamzated-second | 20 (form I in every class, forms II to VI, VIII and X) |
| hamzated-third | 22 (form I in every class and forms II to VIII and X) |
| hollow-ya + hamzated-third | 5 (the verbs of the class, Wright §174, and هيأ), form I a ~ i and i ~ a, forms II, IV and V |
| hollow-waw + hamzated-third | 4 (the verbs of the class, Wright §174), form I a ~ u, forms IV, V, VIII and X |
| assimilated-waw | 28 (every resolving choice, forms V, VI, VIII and X included) |
| assimilated-ya | 12 (the attested sound ya-first roots; there are not 20), forms II, III, V, VI, VIII and X included |
| hollow-waw | 23 (every resolving choice, forms II to X included) |
| hollow-ya | 22 (every resolving choice, forms II to X included) |
| final-weak-ya | 23 (every resolving choice, forms II to VIII and X included) |
| final-weak-waw | 24 (every resolving choice, form I u ~ u and forms II to VIII and X included) |
| geminate | 26 (every resolving choice, forms II to VIII and X included) |
| assimilated-waw + final-weak-ya | 13 (the lafif mafruq verbs of the lexicons), forms II, III, V, VI, VIII and X included |
| hollow-waw + final-weak-ya | 20 (every resolving choice, forms II to VIII and X included) |
| hamzated-first + final-weak-ya | 6 (all the verbs of the class), form I a ~ i and forms II to V and X |
| hamzated-second + final-weak-ya | 2 (the two verbs of the class with tables, نأي and رأي), form I a ~ a and forms III, VI and VIII |
| hollow-ya + final-weak-ya | 2 (the two verbs of the class, Wright §177), forms II, IV and X |

## Defects found in seeded data

- **`f1-a-i-geminate` masdar** (repaired by `db/0050`). Its template was `{1}ُ{2}ّ` (فُعّ), so فرّ got فُرّ and مدّ got
  مُدّ instead of the فَعْل default every other form I pattern uses (فَرّ, attested in the Wiktionary table of فرّ; شَدّ
  for شدّ). `0050` rewrites the template to `{1}َ{2}ّ` with an update guarded on the old value; the pattern trigger
  regenerates the affected entries. The pinned digest of `مدد f1-a-i-geminate` in `golden/derived-corpus.txt` changed
  with it, and the fixtures `form-1-a-i-geminate-frr` and `-sdd` no longer record an engine deviation.
- **`f1-a-a-final-weak-hamzated-middle` (نَأَى)** gave يَنْءَى when the root was typed نءي (a bare hamza after sukun was
  not seated). Fixed by the hamza canonicalisation of `db/0054`.

## Design proposals

### A. Hamza canonicalisation (implemented in `db/0054_hamza_seating.sql`)

`replace_root_placeholders` writes a hamza radical as the bare hamza whichever of ء أ إ آ ؤ ئ the root was typed with
(`canonical_hamza_root`), and `normalize_arabic_hamza_seating_bare` seats each bare hamza by Wright §§131-135 from its
two neighbours, whatever pattern produced the word:

| before the hamza | hamza with fatha | with damma | with kasra | with sukun or word-final |
| --- | --- | --- | --- | --- |
| nothing (word-initial) | أ | أ | إ | أ |
| fatha | أ | ؤ | ئ | أ |
| damma | ؤ | ؤ | ئ | ؤ |
| kasra | ئ | ئ | ئ | ئ |
| sukun | أ | ؤ | ئ | on the line (a final hamza takes its own vowel: يَنْأَ) |
| long ā | on the line | ؤ | ئ | on the line |
| long ū or waw sukun | on the line | on the line | ئ | on the line |
| long ī or yeh sukun | ئ | ئ | ئ | on the line |

A final hamza is seated by the vowel before it alone (the case vowel does not count): قَرَأَ, بَرِئَ, بَطُؤَ, قَارِئ,
مَقْرُوء, بَدْء, جِيء. The merge of a quiescent hamza into the long vowel of a prefix hamza (أَأْ → آ, أُؤْ → أُو,
إِئْ → إِي) gives the 1st singular أُومِنُ and the masdar إِيمَان of form IV. `resolve_morph_pattern_id` finds an
override whichever hamza letter the root was typed with. The table is asserted by `invariants/hamza-seating.test.ts`
against 70 attested spellings and, over 20,000 generated strings, against an oracle written as a table. A mutation
(the seat after damma written on alif) fails 24 tests.

The sound templates therefore serve every hamzated shape; what is still missing is listed under "Not covered".

### B. Quadriliteral roots (implemented in `db/0080_quadriliteral_engine.sql`, `db/0081_quadriliteral_patterns.sql`, `db/0082_quadriliteral_final_weak_engine.sql` and `db/0083_quadriliteral_final_weak_pattern.sql`)

A verb form is now the pair (`form_number`, `radical_count`). The four-radical forms keep the form numbers 1 to 4 and
carry `radical_count = 4`; the picker choices are `form-1q` to `form-4q` and the public pages
`/arabic-verb-form/1q` to `/4q`. `db/README.md` ("Quadriliteral verbs") describes the schema, the generators and how to
add a pattern; this section says what is covered.

| form | code | pattern | root | paradigm |
| --- | --- | --- | --- | --- |
| Iq | `f1-a-i-quadriliteral` | فَعْلَلَ يُفَعْلِلُ | دحرج | دَحْرَجَ يُدَحْرِجُ، دَحْرَجَة، مُدَحْرِج، مُدَحْرَج |
| IIq | `f2-quadriliteral` | تَفَعْلَلَ يَتَفَعْلَلُ | دحرج | تَدَحْرَجَ يَتَدَحْرَجُ، تَدَحْرُج، مُتَدَحْرِج، مُتَدَحْرَج |
| IIIq | `f3-quadriliteral` | اِفْعَنْلَلَ يَفْعَنْلِلُ | حرجم | اِحْرَنْجَمَ يَحْرَنْجِمُ، اِحْرِنْجَام، مُحْرَنْجِم، مُحْرَنْجَم |
| IVq | `f4-quadriliteral` | اِفْعَلَلَّ يَفْعَلِلُّ | قشعر | اِقْشَعَرَّ يَقْشَعِرُّ، اِقْشِعْرَار، مُقْشَعِرّ، مُقْشَعَرّ |
| IIIq, last radical ي | `f3-quadriliteral-final-weak` | اِفْعَنْلَى يَفْعَنْلِي | سلقي | اِسْلَنْقَى يَسْلَنْقِي، اِسْلِنْقَاء، مُسْلَنْقٍ، مُسْلَنْقًى |

Iq takes the imperfect prefixes in damma (as form II), IIq those of form V, IIIq those of form VII; IVq spells every
person out (like form IX), with the contracted perfect اِقْشَعَرَّ and the uncontracted اِقْشَعْرَرْتُ.

**Resolution.** Every four-letter root resolves to the sound shape: a weak letter before the last radical is a consonant
here (سَيْطَرَ, هَرْوَلَ, وَسْوَسَ, طَمْأَنَ, أَسْلَمَ), so the first, second and third radicals never change the pattern.
The matrix of four-radical shapes is [`golden/quad-resolution-matrix.txt`](./golden/quad-resolution-matrix.txt); it
shows eight shapes resolving in all four forms, the final-weak roots with a final ي resolving in form IIIq only and the
ones with a final و not resolving. The triliteral matrix above is unchanged except that its list of overrides gains the
anchor rows of `0081` and `0083`.

| shape (example) | 1q | 2q | 3q | 4q |
| --- | --- | --- | --- | --- |
| sound (دحرج) | X | X | X | X |
| reduplicated (زلزل) | X | X | X | X |
| glide-second (سيطر) | X | X | X | X |
| glide-third (هرول) | X | X | X | X |
| waw-first (وسوس) | X | X | X | X |
| hamza-first (أسلم) | X | X | X | X |
| hamza-other (طمأن) | X | X | X | X |
| third-equals-fourth (جلبب) | X | X | X | X |
| final-weak ya (سلقي) | - | - | X | - |
| final-weak waw (سلقو) | - | - | - | - |

**Sources.** Every fixture is a Wiktionary conjugation table, with the revision in its `source`, and the formation of the
four forms follows Wright, vol. I, §§67-72 (formation), 118 (the imperfect) and 203 (the quadriliteral forms), read in
the vendored OCR text. 33 paradigms are asserted cell by cell
([`fixtures/quad-paradigms-form-1q.ts`](./fixtures/quad-paradigms-form-1q.ts) with 17,
[`fixtures/quad-paradigms-forms-2q-4q.ts`](./fixtures/quad-paradigms-forms-2q-4q.ts) with 12,
[`fixtures/quad-paradigms-final-weak.ts`](./fixtures/quad-paradigms-final-weak.ts) with 4; the test is
[`paradigm/quad-paradigms.test.ts`](./paradigm/quad-paradigms.test.ts)): Iq دحرج، ترجم، بعثر، خربش، عربد، فلسف، جلبب،
زلزل، دمدم، قهقه، كركر، عسعس، ثرثر، وسوس، هرول، سيطر، طمأن; IIq دحرج، زلزل، بعثر، جلبب، مذهب، فلسف; IIIq حرجم;
IVq قشعر، طمأن، كفهر، شمأز، ضمحل; IIIq with a final ي سلقي، سردي، غردي، غلثي. They were written from the tables before the
engine produced anything. The four final-weak fixtures are the whole of Wiktionary's category of final-weak IIIq verbs;
only اِغْرَنْدَى has a passive participle in its table (مُغْرَنْدًى), the others leave the cell empty and the test skips it.

**Sweep.** [`paradigm/quad-sweep.test.ts`](./paradigm/quad-sweep.test.ts) runs 115 four-letter roots of eight shapes
([`fixtures/quad-sweep-roots.ts`](./fixtures/quad-sweep-roots.ts), from the Wiktionary categories of Iq, IIq, IIIq and
IVq verbs) through the four forms with the structural invariants of the triliteral sweep and the hamza-spelling
invariance of the fourth radical.

| shape | roots swept |
| --- | --- |
| sound | 24 |
| reduplicated | 24 |
| glide-second | 19 |
| glide-third | 17 |
| hamza-first | 17 |
| hamza-other | 5 |
| third-equals-fourth | 5 |
| waw-first | 4 |

The four final-weak IIIq roots (`QUAD_FINAL_WEAK_ROOTS`) are not part of this table: the same file runs them through the
structural invariants and the comparison of a stored entry with the pattern preview in two tests of their own, and
checks that they resolve in form 3q and nowhere else.

**Not covered, and why.**

| what | why |
| --- | --- |
| final-weak four-letter roots in the forms Iq, IIq and IVq, and with a final و in every form | no table: Wiktionary's categories of Iq, IIq and IVq verbs (fetched 2026-10-14) hold no final-weak verb, and no table of a verb with a final و exists, so the resolver returns no pattern and the admin form says so (a final و is written ي in the derived forms, Wright §169, but that is not a table) |
| IIq with the omission of one of the two ت (Wright §118 rem. a) | the tables write both; the pattern writes both, and no table prints the form with one ت, so it is not shipped as an alternative |
| the passive voice of IIq, IIIq and IVq | the tables give an impersonal passive (11 of 13) or none; two print a full passive because their page asks for one (اِغْرَنْدَى of IIIq, اِشْمَأَزَّ of IVq) and Wright §118 inflects these forms like VII and IX, which have none (§73, §110). The pattern would give every verb of the form a passive that the other tables deny |
| IIIq of any root but حرجم, and a hamza as first radical in any form | Wiktionary has no other table of a sound IIIq verb; the engine produces these by the same rules and the sweep checks their structure only |

### C. Passive voice (implemented in `db/0060_passive_voice.sql`, data in `db/0061`-`db/0064`)

**Rules keys.** `passive_perfect`, and `passive_imperfect_stem` or the three per-mood keys `passive_imperfect_indicative`,
`passive_imperfect_subjunctive` and `passive_imperfect_jussive`. Each is a template string or a per-person object like its
active counterpart, validated by `src/lib/validation/morphPatternRules.ts` (a stem next to explicit moods is refused, a
`no_affix` pattern spells every key out per person) and edited in the pattern form, whose preview shows the passive
table. There is no passive imperative (Wright §101: the jussive does its work).

**Generation.** The passive generator does not duplicate the active one. `generate_passive_rows_from_affixes` renames the
passive keys to their active names and calls `generate_conjugation_rows_from_affixes` with the affix rows of form 2
(`prepared_passive_affix_rules`): the passive imperfect takes the damma prefixes of form 2 for every form
(`يُكْتَبُ`, `يُسْتَخْرَجُ`), the passive perfect takes the perfect suffixes of form 0. The hamza seating, `ُوْ → ُو`,
the gemination of `XْX` and the Form VIII assimilation of `{1}ْت` therefore apply unchanged. One rule belongs to the
passive alone: a vowelless ya after damma is written waw (Wright §147), which gives the impersonal `يُوسَرُ` for يسر
and the sourced `اُسْتُوقِظَ` for استيقظ (Wiktionary tables يسر, يبس, يئس, استيقظ).

**Storage.** `regenerate_passive_conjugations` upserts the rows by `(voice, mood, person)` with `voice = 'passive'`. The
active regeneration no longer touches rows of another voice. `morphology_overrides.no_passive` removes the passive rows
as it already removed the passive participle. The conjugation table on the entry page shows a second block, "passive
voice" `الْفِعْل الْمَجْهُول`, when passive rows exist.

**Test method.** Tier A: 194 passive tables from Wiktionary (`fixtures/passive-paradigms*.ts`: the passive perfect and the
three passive moods, 13 persons each, page and revision in `source`) are asserted from the pattern rules alone
(`paradigm/passive-paradigms.test.ts`), and stored under `voice = 'passive'` by `integration/passive-storage.test.ts`.
124 further tables whose passive is impersonal (78) or absent (46) are in `fixtures/passive-absent.ts`: for the 60
impersonal ones that sit on a pattern with a passive the third masculine singular of all four moods must be the
generated cell, and for all 124 an entry with `no_passive` must keep its active rows and have no passive row (22
absent tables sit on a pattern with a passive, so those entries need the flag). Tier B: the `golden/derived-corpus.txt`
entries of the patterns that carry a passive gained their passive rows (57 to 109 rows for the affected entries).
Tier C: `paradigm/passive-sweep.test.ts` generates the passive of every swept root under every verb form choice and
checks that the paradigm is complete, has no placeholder residue, stacked marks or vowelless ya after damma, takes damma
on every imperfect prefix, differs from the active perfect, and equals the stored rows; `integration/passive-pattern-data.test.ts`
pins the rule data (complete, no imperative, 13 persons per object, only the placeholders `{1}` to `{3}` (`{4}` as well on the one four-radical pattern with a passive, which must name it in every template), the waw and
ya twins of the derived defective forms identical, no passive for forms VII and IX or the u ~ u verbs).

**Patterns with a passive (69).** Forms I to VI, VIII and X where the sources give a full passive, in four scripts: 0061
(26 patterns with string templates: sound, assimilated and hamzated shapes), 0062 (10 hollow), 0063 (26 final-weak and
doubly weak) and 0064 (7 geminate). The table "Patterns added in round 2" above has a row per group.

**Patterns without a passive (16), and why.**

| pattern | reason |
| --- | --- |
| `f7`, `f7-final-weak`, `f7-geminate`, `f7-hollow` | form VII is reflexive in meaning; every Wiktionary table is "no passive" or "impersonal passive" |
| `f9` | form IX (colours and defects) takes no passive (Wright §110) |
| `f1-u-u`, `f1-u-u-assimilated`, `f1-u-u-hollow-waw` | verbs of state are neutral and take no passive (Wright §73); the tables of the sound and assimilated ones say "no passive" or "impersonal passive", those of أنس and طال say "full passive" (a deviation, below) |
| `f6-final-weak`, `f6-geminate`, `f6-hamzated-third` | the tables give only an impersonal passive or none |
| `f10-assimilated-waw-final-weak` | استولى: the table gives an impersonal passive only |
| `f1-i-a-hollow-ya-final-weak` | حيي: "no passive" in the table |
| `f1-i-a-hollow-waw-strong-inflection`, `f8-hollow-strong-inflection`, `f10-hollow-strong-inflection` | lexical patterns of عور حول, ازدوج اجتور, استحوذ: the tables say "no passive" or "impersonal passive" |

**Deviations from the proposal.** The generator is a new function that delegates to the active one rather than a third
column on `generate_conjugation_rows` (which is shared with the quadriliteral work), and the affix rows of form 2 are
reused instead of a `voice` column on `affix_rules`. Impersonal passives (a third masculine singular of an
intransitive verb) are not generated: where a table lists one for a verb on a pattern that has a
passive, the pattern generates the full passive and the third masculine singular is the sourced impersonal cell
(`integration/passive-storage.test.ts` pins all of them), and the entry carries `no_passive` for a verb that must not
show the rest. Wiktionary lists a full passive for two u ~ u verbs (أَنُسَ `f1-u-u`, طَالَ `f1-u-u-hollow-waw`; the tables are in
`weak-paradigms-form-1.ts`), and their patterns carry none, on purpose. The two sources disagree and the rule of this suite is
that a form needs both: Wright §73 excludes "intransitive verbs of the form فَعُلَ" that "designate not an act but a state or
condition" from the passive, and أَنُسَ (to be sociable) and طَالَ (to be long) are such verbs, while the tables of the other
u ~ u verbs (أَمُنَ, وَسُمَ, يَسُرَ, يَتُمَ, بَؤُسَ, بَطُؤَ: "no passive"; وَثُقَ, جَرُؤَ: impersonal passive only) give none. The pages mark the passive
themselves (`{{ar-conj|I/u~u.pass…}}` on أنس at revision 92916143, `{{ar-conj|I/a~u.pass…}}` on طال at revision 93327779, which
also has an `I/a~u.nopass` line for another reading), so it is an editor's choice that Wright §73 does not support. A passive on
`f1-u-u` or `f1-u-u-hollow-waw` would be given to every verb of the class, and a lexical pattern for the two verbs would put a
paradigm in the dictionary that the grammar says does not exist. If a source that states the passive of one of them turns up, the
way in is a lexical pattern with an override row (as for عَوِرَ), not a passive on the shape pattern.

### D. Weak radicals typed as ى or ا (implemented in `db/0053_weak_radical_spelling.sql`)

`strip_root_noise` and `normalizeRoot` fold ى to ي and compose to NFC, `require_triliteral_root` and the entry schema
refuse ا in a verb root with a message asking for و or ي (`دعا` is ambiguous between دعو and دعي; a noun root may keep
it). A root typed رمى now classifies as final-weak-ya and resolves the final-weak patterns; the script also folds the
stored roots of existing entries and overrides. Tests: `integration/weak-radical-spelling`,
`integration/root-normalization-mirror` (SQL and TypeScript agree on 20,000 generated strings), `unit/entry-schema`.

### E. Alternative forms per cell (implemented in `db/0103` to `db/0106`)

The geminate, سأل (سَلْ), أمر (اُؤْمُرْ) and hamza spelling alternatives show that one form per cell drops attested variants.
They are data in `morph_pattern_alternative` (one complete word template per cell, optionally restricted to one root),
evaluated at read time by `entry_alternative_forms(entry_ids)` and handed to the entry page as `entry.alternatives`
(`AlternativeFormsByCell`); `src/components/entry/AlternativeForms.tsx` renders a cell's list under its primary form. The
generators, the regeneration triggers and the stored paradigm are untouched, so every golden stays byte-identical. A table
beside `morph_pattern` rather than a jsonb column of it, because an alternative can belong to one verb of a shared shape
pattern (سأل shares `f1-a-a` with every sound a ~ a verb) and the rows then get their enum types, a key, a cascade and an index
on the pattern. Mechanism and queries: "Alternative forms" in [`db/README.md`](../db/README.md).

Shipped (275 rows of `morph_pattern_alternative`, 91 of them in the passive voice, and 4 of `morph_pattern_alternative_noun`). Each set is checked cell by cell against the printed cells of every sourced table of the pattern in
[`fixtures/alternatives-cells.ts`](./fixtures/alternatives-cells.ts) by
[`paradigm/alternatives-sources.test.ts`](./paradigm/alternatives-sources.test.ts), which also asserts that every other
sourced paradigm, triliteral and four-radical, gets none:

| alternatives | where | printed by |
| --- | --- | --- |
| jussive 1s, 2ms, 3ms, 3fs, 1p: contracted with kasra and uncontracted (يَمُدِّ, يَمْدُدْ); imperative 2ms: contracted with fatha and kasra beside the uncontracted primary (مُدَّ, مُدِّ) | the nine geminate patterns of forms I (a ~ u, a ~ i, i ~ a), III, IV, VI, VII, VIII and X | every Wiktionary table of every geminate verb in the sources (33 verbs); Wright vol. I §121, §122, §125 |
| the same cells for form IX (يَبْيَضِّ, يَبْيَضِضْ, اِبْيَضِّ, اِبْيَضِضْ) | `f9` | the tables of اِبْيَضَّ, اِعْوَجَّ and اِسْوَدَّ. Wright §123 says that forms II, V, IX and XI undergo no contraction (De Goeje's note there ascribes the contracted jussives to the dialect of Tamim and the uncontracted ones to that of Hijaz), so the contracted spellings are Wiktionary only: the stored form is the first spelling of the table and the notes of `0116` say so |
| jussive of all 13 persons and imperative of all 5 (يَسَلْ, سَلْ) | root سأل on `f1-a-a` | the table of سَأَلَ; Wright §140 |
| imperative (اُؤْمُرْ) | root أمر on `f1-a-u-hamza-elided-in-the-imperative` (not أكل or أخذ, whose tables print none) | the table of أَمَرَ; Wright §137 gives مُرْ |
| the seat of the hamza before the plural ending: perfect 3mp, imperfect 2mp and 3mp, imperative 2mp (جَائُوا, تَجِيؤُونَ, سُوئُوا, شَائُوا) | the three hollow + hamzated-third patterns (جاء, ساء/ناء, شاء), written verbatim | the tables of جَاءَ, سَاءَ, نَاءَ, شَاءَ; Wright §§131-135 |
| apocopated jussive يَكُ beside يَكُنْ | root كون on `f1-a-u-hollow-waw` | the table of كَانَ; Wright §151 rem. (sometimes further abbreviated, especially by the poets) |
| a second verbal noun: زِلْزَال beside زَلْزَلَة, ثَرْثَار beside ثَرْثَرَة, وَسْوَاس and وِسْوَاس beside وَسْوَسَة | the roots زلزل, ثرثر and وسوس on `f1-a-i-quadriliteral` (`0108`, 4 rows of `morph_pattern_alternative_noun`) | the tables of زَلْزَلَ, ثَرْثَرَ and وَسْوَسَ; Wright §203 for زِلْزَال |
| the jussive of the passive of the geminate patterns: contracted with fatha, contracted with kasra and uncontracted (يُمَدَّ, يُمَدِّ, يُمْدَدْ); the second seat of the hamza before the plural ending in the passive (جِيئُوا, جِيؤُوا) | the seven geminate patterns of forms I (a ~ u, a ~ i, i ~ a), III, IV, VIII and X, and the three hollow patterns with a final hamza (`0117`, 91 rows with `voice = 'passive'`) | the tables of the 22 geminate verbs with a full passive and of جَاءَ, شَاءَ, سَاءَ and نَاءَ whose passive is full; Wright §123 and §§131-135 |
| the same cells for form IVq: jussive 1s, 2ms, 3ms, 3fs, 1p and imperative 2ms, contracted with kasra and uncontracted (يَقْشَعِرَّ, يَقْشَعِرِّ, يَقْشَعْرِرْ) | `f4-quadriliteral` (`0107`, 12 rows) | the tables of اِقْشَعَرَّ, اِطْمَأَنَّ, اِكْفَهَرَّ, اِشْمَأَزَّ, اِضْمَحَلَّ; Wright §118 |

Not shipped, and why:

- The `-ayt-` perfect of geminate form X (اِسْتَمَرَّيْتُ beside اِسْتَمْرَرْتُ, 1st and 2nd persons): four of the five sourced
  tables print it, the cached page does not explain it and Wright does not mention it. The fixtures list the cells with
  `shipped: false`, and the test asserts that none is produced.
- Wright's third vowel of the jussive of an a ~ u geminate (يَمُدُّ, §121): no Wiktionary table prints it.
- The 44 cells of the verbs that take two imperfect vowels (أَجَرَ يَأْجُرُ / يَأْجِرُ, أَنَسَ, دَأَبَ, زَأَرَ, هَنَأَ, يَبِسَ): the
  second vowel class is a second pattern of the same verb, not a spelling of a cell. They get no alternatives.
- The passive jussive of سَأَلَ (أُسْأَلْ beside أُسَلْ): the table prints it, but Wright §140 describes the active voice only. The
  fixtures list the 13 cells with `shipped: false`.
- The passive alternatives of verbs whose table gives an impersonal passive or none (ظَلَّ, فَرَّ, شَدَّ, اِرْتَدَّ, اِمْتَدَّ, اِهْتَمَّ …): the
  entry carries `no_passive`, so it stores no passive cell. The fixtures mark these tables with `noPassive`.
- The passive of IVq: the table of اِشْمَأَزَّ prints a full passive with the same three spellings, but the pattern has no passive
  (Wright §118 inflects the form like IX, which has none).
- The other cells of the Wiktionary tables that print more than one form for a single verb (the second verbal noun of a
  triliteral verb, a second participle).

Integration: `ConjugationTable` takes an optional `alternatives` prop and renders `AlternativeForms` after each primary form;
`EntryDetail` passes `entry.alternatives` (applied lines in the final report of the round).

### F. Anchor the أُو → ؤُو rewrite (implemented in `db/0051_anchor_hamza_waw_yeh.sql`)

The rewrites of أُو to ؤُو and أِي to ئِي apply only when the hamza is not word-initial, so the 1st singular imperfect of
forms II, III and IV of waw-first roots keeps its alif seat (أُوَحِّدُ, أُوَاصِلُ, أُوجِدُ, أُوفِي). `0052` adds the
resolution rows and the form IV patterns the five pending fixtures needed; all five are active.

### G. More than one verb per root, form and vowel class (implemented in `db/0100` to `db/0102`)

**Problem.** An entry gets its pattern only from the verb form choice (`withResolvedMorphPattern` in
`src/server/actions/lexical-entry.ts` calls `resolve_morph_pattern_id`), and `lexical_pattern_override` is keyed by
(root, form, vowels). Where one root has two verbs in the same form that inflect differently, only one could be reached:
اِسْتَجَابَ (to respond, weak) and اِسْتَجْوَبَ (to interrogate, strong, Wright §163) are both form X of جوب.

**Change.** `lexical_pattern_override.variant text` (declared in `db/schema.sql`) is part of the unique
key and NULL for the default. `resolve_morph_pattern_id` ignores variant rows (one added condition in `0080`). `morph_pattern_variants`
lists the resolved pattern first and then the lexical patterns of same-root, same-form, same-vowel variant rows, with the verb each
produces; `morph_pattern_choice_allowed` checks one id against that list. The entry form shows a "Verb variant" select when the list
has more than one pattern, and the entry action stores a chosen pattern id only after that check; an entry saved without a choice
keeps its stored pattern while it is still allowed. The override form, the override pages and the pattern page learned the field,
and a variant must point to a lexical pattern of its own form and vowels (trigger and action).

**Worked example.** `0102` ships the override (جوب, form X, variant `interrogate`, `f10-hollow-strong-inflection`): an admin picks
اِسْتَجْوَبَ for one entry while every other form X entry of جوب keeps اِسْتَجَابَ. Expected paradigm: Wiktionary, entry استجوب
(revision 93321030), every finite cell, in `tests/integration/variants-data.ts`; the end-to-end path is
`e2e/specs/variants.stateful.spec.ts`. The resolution matrix does not see variants (it resolves shapes); the "Lexical overrides" list of its golden prints
the variant after the root, so the جوب row reads `جوب variant interrogate`.

## Mutation checks

Each row is one edit of a script or of the code, made alone, followed by the whole suite (2,716 tests for the rows up to
and including `0080`, 2,745 for the rows of the final-weak work) and undone with `git checkout`; the last three rows ran
the unit files of the edited code only, because no SQL is involved. A check that fails nothing needs a new test: one did
(the row for `classify_quadriliteral_radical4`).

| edit | script | tests that failed |
| --- | --- | --- |
| `passive_vowelless_ya_after_damma` returns its input (the vowelless ya after damma stays ya) | `0060` | 6: `derived-equivalence` (corpus golden), `passive-storage` (3: every passive cell of the fixtures, the impersonal third masculine singular, "a vowelless ya after damma is written waw"), `passive-paradigms` (اِسْتَيْقَظَ), `passive-sweep` (assimilated-ya) |
| the third masculine singular of the passive perfect of `f1-a-u-hollow-waw` takes damma instead of kasra | `0062` | 6: `derived-equivalence`, `passive-pattern-data` (form I passive independent of the active vowels), `passive-storage` (2), `passive-paradigms` (نَالَ), `passive-sweep` (hollow-waw) |
| the conjugation step of `regenerate_derived_stems` loses `CHAR_LENGTH(root) = radical_count` | `0080` | 2: `derived-equivalence` (corpus golden), `derived-status` (a legacy entry with a pattern and a four-letter root needs attention) |
| the stems step of `regenerate_derived_stems` loses the same condition | `0080` | the same 2 |
| the affix join of the conjugation step ignores `radical_count` | `0080` | 1: `quad-engine` (every regeneration path leaves the same derived data for triliteral and quadriliteral entries) |
| `replace_root_placeholders` leaves `{4}` in place | `0080` | 82: `quad-paradigms` (58), `quad-sweep` (8), `goldens` (4), `quad-engine` (6), `quad-flows` (3), `generated-forms` (2), `quad-public` (1) |
| `resolve_morph_pattern_id` drops `variant IS NULL` | `0080` | 14: `variants-sql` (5), `variants-actions` (4), `weak-paradigms` (3: اِسْتَجَابَ), `passive-paradigms` (2: اِسْتَجَابَ) |
| `resolve_morph_pattern_id` stops comparing `radical4_kind` | `0082` | 21: `quad-final-weak` (5), `quad-paradigms` (9: resolution, paradigm and verbal nouns of three final-weak verbs), `quad-engine` (2), `quad-flows` (3), `quad-sweep` (1), `quad-resolution` (the matrix golden) |
| `classify_quadriliteral_radical4` leaves a hamza a hamza instead of a sound letter | `0082` | 1: `quad-final-weak` (a hamza as the last radical). The first run of this edit failed nothing, so the test was written |
| `add_morph_pattern_resolution` stops comparing `radical4_kind` when it looks for a taken shape | `0082` | 1: `quad-final-weak` (the example root of a taken shape is refused) |
| `trg_sync_morph_pattern_resolution` no longer fires on `radical4_kind` | `0082` | 2: `quad-final-weak` (changing the fourth radical kind moves its own resolution row), `enum-parity` (the schema inventory prints the trigger) |
| the third feminine plural of the imperfect of `f3-quadriliteral-final-weak` loses `{4}` | `0083` | 5: `quad-paradigms` (four fixtures), `goldens` (the pattern's paradigm) |
| `chk_morph_pattern_radical4_kind` allows a weak fourth radical on a triliteral pattern | `20261015080237` | 1: `quad-final-weak` |
| `chk_morph_pattern_radical4_kind` allows a hamza as the fourth radical | `20261015080237` | 1: `quad-final-weak` |
| the pattern form schema accepts a hamza as the fourth radical | `schema.ts` | 2 (unit files `morphPatternFormSchema` and `quad-flows`): the schema test and the action that creates a four-radical pattern |
| `findAmbiguousPattern` stops comparing the fourth radical | `admin.ts` | 2 (unit files `repository-admin` and `quad-flows`): the matching key and the refusal of a twin of the final-weak pattern |
| `createMorphPatternAction` stops passing `radical4Kind` to the ambiguity check | `morph-pattern.ts` | 1 (unit file `quad-flows`): the refusal of a twin of the final-weak pattern |
| `entry_alternative_nouns` keeps a form equal to the stored noun | `0108` | 3 in the files `alternative-nouns-sql`, `alternatives-sources` and `alternatives-query` |
| `entry_alternative_nouns` ignores the root of a row | `0108` | 5 |
| `entry_alternative_nouns` compares with `IS DISTINCT FROM`, so it lists a noun the entry lacks | `0108` | 1: the entry with `no_passive` |
| `entry_alternative_nouns` drops `CHAR_LENGTH(root) = radical_count` | `0108` | 1: a stale entry of another root length. The first run of this edit failed nothing, so the entry was written |
| `entry_alternative_nouns` orders by the form instead of the ordinal | `0108` | 1. The first run failed nothing, because the test helper sorted the rows itself; the helper no longer sorts |
| `entry_alternative_nouns` lists repeated forms of one noun | `0108` | 17 |
| `entry_alternative_nouns` ignores `verbatim` | `0108` | 1 |
| `entry_alternative_nouns` ignores the infix of form VIII | `0108` | 1 |
| `entry_alternative_nouns` passes no fourth radical | `0108` | 4 |
| `entry_alternative_nouns` compares the active participle with the stored verbal noun | `0108` | 1 |
| the trigger `trg_normalize_morph_pattern_alternative_noun_root` never fires | `0108` | 1 |
| `getEntryAlternatives` drops the nouns | `alternatives.ts` | 1 (unit file `alternatives-query`) |
| `getLexicalEntryBySlug` does not attach `alternativeNouns` | `detail.ts` | 1 (unit file `alternatives-query`) |
| `ConjugationTable` passes no alternative to the principal parts | `ConjugationTable.tsx` | 2 (unit files `alternatives-component` and `public-components`) |
| `EntryDetail` does not pass `alternativeNouns` | `EntryDetail.tsx` | 1 (unit file `public-components`) |
| `regenerate_passive_conjugations` keeps the root length at three | `0065` | 4: `passive-storage` (the stored passive of the first form of the quadriliteral fixtures) and `quad-engine` |
| the `targets` step of `regenerate_passive_conjugations` is not `MATERIALIZED` | `0065` | 3: `derived-equivalence` (corpus golden) and `derived-status` (a legacy entry with a three-radical pattern and a four-letter root). The planner then evaluates the generator for the legacy entry before the radical-count filter, so the filter has to run first |
| the passive perfect of `f1-a-i-quadriliteral` takes fatha on the first radical | `0084` | 14: `passive-paradigms` (11 tables), `passive-storage` and `quad-engine` |
| the passive imperfect stem of `f1-a-i-quadriliteral` takes kasra on the third radical | `0084` | 13 |
| the passive imperfect stem of `f1-a-i-quadriliteral` repeats the third radical for the fourth | `0084` | 12 |
| `entry_alternative_forms` lists an alternative for a cell the entry does not store | `0117` | 2: `alternatives-sql` (an entry with `no_passive`) and `alternatives-sources` (the entries of the tables without a full passive) |
| the passive uncontracted jussive of `f4-geminate` takes kasra | `0117` | 1: `alternatives-sources` |
| the passive hamza seat of the imperfect of `f1-a-i-hollow-ya-hamzated-third` equals the primary one | `0117` | 1 |
| a passive hamza row of the imperfect loses `verbatim` | `0117` | 1. The same edit on the passive perfect row fails nothing: the normaliser leaves the seat after kasra alone, so that row only keeps its spelling as a precaution |
| the passive jussive of `f10-geminate` takes kasra on the second radical | `0117` | 1 |
| `getEntryAlternatives` files the passive rows under the active ones | `alternatives.ts` | 1 (unit file `alternatives-query`) |
| `ConjugationTable` gives the active alternatives to the passive block | `ConjugationTable.tsx` | 3 (unit files `alternatives-component` and `public-components`) |
| `getLexicalEntryBySlug` does not attach `passiveAlternatives` | `detail.ts` | 1 (unit file `alternatives-query`) |
| `EntryDetail` does not pass `passiveAlternatives` | `EntryDetail.tsx` | 1 (unit file `public-components`) |

The rows for `0117` and the four code files ran the files `alternatives-sources`, `alternatives-sql`, `alternatives-query`,
`alternatives-component` and `public-components` only.

The rows for `0065` and `0084` ran the files `passive-paradigms`, `passive-storage`, `quad-engine`, `derived-status` and `derived-equivalence` only.

| edit | script | tests that failed |
| --- | --- | --- |
| the resolution row of `f7` for ذأف is removed | `0118` | 10: the hamza-letter equivalence tests (active and passive), the paradigm and resolution tests of `form-7-hamzated-second-dhf`, the coverage matrix golden |
| the resolution row of `f9` for جأل is removed | `0118` | 12: the same tests for `form-9-hamzated-second-jal`, and the two alternative tests that read its three jussive spellings |
| the resolution row of `f7-hollow` for أود is removed | `0118` | 4: the paradigm and resolution tests of `form-7-hamzated-first-hollow-waw-awd`, the coverage matrix golden |
| the resolution row of `f6` for هيأ is given to `f5` | `0118` | 4: the paradigm and resolution tests of `form-6-hollow-ya-hamzated-third-hya`, the coverage matrix golden |
| the first person singular of the perfect of `f1-u-u-geminate` takes fatha instead of damma | `0119` | 5: the finite paradigm of each of the three fixtures, the golden of the pattern, the weak sweep |
| the active participle of `f1-u-u-geminate` is the one of `f1-a-u-geminate` (the `{1}َ{2}ِي{3}` entry is dropped) | `0119` | 4: the golden of the pattern and the verbal nouns of each fixture (ضَرِير is printed) |
| `f1-u-u-geminate` keeps the masdar of `f1-a-u-geminate` | `0119` | 4: the golden of the pattern and the verbal nouns of each fixture |
| `f1-u-u-geminate` keeps the passive participle of `f1-a-u-geminate` | `0119` | 4: the golden of the pattern and the verbal nouns of each fixture |
| the alternatives of `f1-a-u-geminate` are not copied to `f1-u-u-geminate` | `0119` | 2: the printed alternatives are produced after the primary form, the shipped alternatives belong to the shapes they were written for |
| the alternatives of the passive voice are copied to `f1-u-u-geminate` (the `voice = 'active'` filter is dropped) | `0119` | 1: an alternative of the passive voice belongs to a pattern with a passive (killed by a test written for the pattern without a passive, not by chance) |
| the imperfect of `f1-a-a-final-weak-waw` comes from `f1-a-u-final-weak-waw` instead of `f1-i-a-final-weak-waw` | `0120` | 3: the finite paradigms of عشا and صها, the golden of the pattern |
| the imperative of `f1-a-a-final-weak-waw` comes from `f1-a-u-final-weak-waw` | `0120` | 3: the finite paradigms of عشا and صها, the golden of the pattern |
| `f1-a-a-final-weak-waw` keeps the masdar of `f1-a-u-final-weak-waw` | `0120` | 3: the golden of the pattern, the verbal nouns of عشا and صها |
| the masdar of `f1-a-a-final-weak-hamzated-first` is the schematic one of the plain pattern | `0121` | 3: the verbal nouns of أبي, the golden of the pattern, the printed verbal nouns are produced after the stored one |
| the masdar of `f1-a-i-hollow-waw-final-weak-hamzated-first` is the second printed noun (أُوِيّ) | `0121` | 3: the verbal nouns of أوي, the golden of the pattern, the printed verbal nouns are produced after the stored one |
| the override of أوي is written for another root (أوو) | `0121` | 7: the finite paradigm, the resolution, the golden and the verbal nouns of أوي |
| the template of the noun alternative of أبي loses its ة | `0121` | 1: the printed verbal nouns are produced after the stored one, in the order of the table |
| the two noun alternatives of أوي exchange their templates (the order of the table is reversed) | `0121` | 1: the printed verbal nouns are produced after the stored one, in the order of the table |

The eighteen rows for `0118`-`0121` ran the paradigm files (`weak-paradigms`, `passive-paradigms`, `alternatives-sources`, `goldens`)
the integration files of the alternatives, of the alternative nouns and of the passive storage, `resolution` and `pattern-data`, 1,706 tests for the first two rows and 1,586 for
the others, not the whole suite; the sweep files were left out of the later rows because they take most of the time of a run,
and the whole suite ran green on the final tree. Each edit was made alone and undone afterwards. A first version of the last row only changed an ordinal and was
discarded: it failed nine files because the script no longer loaded (a duplicate key), which says nothing about the order of the nouns.

One more check concerns the browser suite rather than a script: removing the focusable, named region around the scrolling
tables of the pattern preview (`PatternPreviewPanel.tsx`) fails 1 test of `pattern-editor.public.spec.ts` (the preview
renders a paradigm whose Arabic cells carry lang=ar, which now also asserts `tabindex="0"` on the region); the other nine
tests of the file pass. The same edit fails the axe test of the pattern detail page in Firefox, which is where the defect
was found.

The rows for `0108` and the three code files ran the test files of the edited code only (`alternative-nouns-sql`,
`alternatives-sources`, `alternatives-query`, `alternatives-component`, `public-components`), each edit alone and undone afterwards.

The two filters of `regenerate_derived_stems` are covered by two tests only, both integration tests that build an entry
whose root has the wrong length; the paradigm tests never construct one, because the resolver and the entry actions refuse
the pair before it is stored.
