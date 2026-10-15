import { APPENDIX, WRIGHT } from "./paradigms.ts";

export interface AssimilationFixture {
  id: string;
  root: string;
  description: string;
  citationForm: string;
  gloss: string;
  source: string;
  perfectThirdMasculineSingular: string;
  perfectFirstSingular: string;
  imperativeSecondMasculineSingular: string;
  imperfectThirdMasculineSingular: string;
  masdar: string;
  activeParticiple: string;
  passiveParticiple: string;
}

const FATHA = "َ";
const KASRA = "ِ";
const SHADDA = "ّ";

const geminate = (letter: string, vowel: string): string => `${letter}${vowel}${SHADDA}`;

const EMPHASIS =
  "the form VIII section lists ط ض ص ظ among the first radicals whose infixed ـتـ is assimilated, with اِضْطَرَبَ as its example of emphasis assimilation";

export const ASSIMILATION_FIXTURES: AssimilationFixture[] = [
  {
    id: "form-8-sad",
    root: "صبر",
    description: "",
    citationForm: "اِصْطَبَرَ",
    gloss: "to be patient, to endure",
    source: `${APPENDIX}: ${EMPHASIS}, and ص is one of them. Attested in Quran 19:65 (وَاصْطَبِرْ). Remaining cells follow the unassimilated paradigm of اِفْتَرَقَ with ط for the infix, per ${WRIGHT}.`,
    perfectThirdMasculineSingular: "اِصْطَبَرَ",
    perfectFirstSingular: "اِصْطَبَرْتُ",
    imperativeSecondMasculineSingular: "اِصْطَبِرْ",
    imperfectThirdMasculineSingular: "يَصْطَبِرُ",
    masdar: "اِصْطِبَار",
    activeParticiple: "مُصْطَبِر",
    passiveParticiple: "مُصْطَبَر",
  },
  {
    id: "form-8-dad",
    root: "ضرب",
    description: "",
    citationForm: "اِضْطَرَبَ",
    gloss: "to be agitated, to be disturbed",
    source: `${APPENDIX}: lists اِضْطَرَبَ = ت + ضَرَبَ as the example of emphasis assimilation. Remaining cells follow the unassimilated paradigm with ط for the infix, per ${WRIGHT}.`,
    perfectThirdMasculineSingular: "اِضْطَرَبَ",
    perfectFirstSingular: "اِضْطَرَبْتُ",
    imperativeSecondMasculineSingular: "اِضْطَرِبْ",
    imperfectThirdMasculineSingular: "يَضْطَرِبُ",
    masdar: "اِضْطِرَاب",
    activeParticiple: "مُضْطَرِب",
    passiveParticiple: "مُضْطَرَب",
  },
  {
    id: "form-8-zah",
    root: "ظلم",
    description: "",
    citationForm: "اِظْطَلَمَ",
    gloss: "to be wronged",
    source: `${APPENDIX}: gives three attested forms for this root, اِظَّلَمَ, اِطَّلَمَ and اِظْطَلَمَ (iẓṭalama); the engine implements the emphasis-assimilated third. ${WRIGHT}.`,
    perfectThirdMasculineSingular: "اِظْطَلَمَ",
    perfectFirstSingular: "اِظْطَلَمْتُ",
    imperativeSecondMasculineSingular: "اِظْطَلِمْ",
    imperfectThirdMasculineSingular: "يَظْطَلِمُ",
    masdar: "اِظْطِلَام",
    activeParticiple: "مُظْطَلِم",
    passiveParticiple: "مُظْطَلَم",
  },
  {
    id: "form-8-zain",
    root: "زحم",
    description: "",
    citationForm: "اِزْدَحَمَ",
    gloss: "to be crowded",
    source: `${APPENDIX}: lists اِزْدَحَمَ = ت + زَحَمَ as the example of voicing assimilation, the infixed ت becoming د after ز. Remaining cells follow the unassimilated paradigm with د for the infix, per ${WRIGHT}.`,
    perfectThirdMasculineSingular: "اِزْدَحَمَ",
    perfectFirstSingular: "اِزْدَحَمْتُ",
    imperativeSecondMasculineSingular: "اِزْدَحِمْ",
    imperfectThirdMasculineSingular: "يَزْدَحِمُ",
    masdar: "اِزْدِحَام",
    activeParticiple: "مُزْدَحِم",
    passiveParticiple: "مُزْدَحَم",
  },
  {
    id: "form-8-tah",
    root: "طلع",
    description: "",
    citationForm: "اِطَّلَعَ",
    gloss: "to look at, to become informed",
    source: `${APPENDIX}: ط is in its list of triggering first radicals, and the infixed ت is absorbed so that the two emphatics merge into one geminate ط. Attested in Quran 18:18 (لَوِ اطَّلَعْتَ). ${WRIGHT}.`,
    perfectThirdMasculineSingular: `اِ${geminate("ط", FATHA)}لَعَ`,
    perfectFirstSingular: `اِ${geminate("ط", FATHA)}لَعْتُ`,
    imperativeSecondMasculineSingular: `اِ${geminate("ط", FATHA)}لِعْ`,
    imperfectThirdMasculineSingular: `يَ${geminate("ط", FATHA)}لِعُ`,
    masdar: `اِ${geminate("ط", KASRA)}لَاع`,
    activeParticiple: `مُ${geminate("ط", FATHA)}لِع`,
    passiveParticiple: `مُ${geminate("ط", FATHA)}لَع`,
  },
  {
    id: "form-8-dal",
    root: "درك",
    description: "",
    citationForm: "اِدَّرَكَ",
    gloss: "to catch up, to overtake",
    source: `${APPENDIX}: lists اِدَّرَكَ = ت + دَرَكَ as the example of complete assimilation. Remaining cells follow the unassimilated paradigm, per ${WRIGHT}.`,
    perfectThirdMasculineSingular: `اِ${geminate("د", FATHA)}رَكَ`,
    perfectFirstSingular: `اِ${geminate("د", FATHA)}رَكْتُ`,
    imperativeSecondMasculineSingular: `اِ${geminate("د", FATHA)}رِكْ`,
    imperfectThirdMasculineSingular: `يَ${geminate("د", FATHA)}رِكُ`,
    masdar: `اِ${geminate("د", KASRA)}رَاك`,
    activeParticiple: `مُ${geminate("د", FATHA)}رِك`,
    passiveParticiple: `مُ${geminate("د", FATHA)}رَك`,
  },
  {
    id: "form-8-thal",
    root: "ذكر",
    description: "",
    citationForm: "اِدَّكَرَ",
    gloss: "to remember, to take heed",
    source: `${APPENDIX}: gives three attested forms for this root, اِذَّكَرَ, اِدَّكَرَ and اِذْدَكَرَ; the engine implements the second, in which the pair assimilates to a geminate د. Attested in Quran 12:45 (وَادَّكَرَ). ${WRIGHT}.`,
    perfectThirdMasculineSingular: `اِ${geminate("د", FATHA)}كَرَ`,
    perfectFirstSingular: `اِ${geminate("د", FATHA)}كَرْتُ`,
    imperativeSecondMasculineSingular: `اِ${geminate("د", FATHA)}كِرْ`,
    imperfectThirdMasculineSingular: `يَ${geminate("د", FATHA)}كِرُ`,
    masdar: `اِ${geminate("د", KASRA)}كَار`,
    activeParticiple: `مُ${geminate("د", FATHA)}كِر`,
    passiveParticiple: `مُ${geminate("د", FATHA)}كَر`,
  },
  {
    id: "form-8-theh",
    root: "ثخن",
    description: "",
    citationForm: "اِثَّخَنَ",
    gloss: "to be weakened, to be incapacitated",
    source: `${APPENDIX}: lists اِثَّخَنَ = ت + ثَخَنَ as the example of complete assimilation. Remaining cells follow the unassimilated paradigm, per ${WRIGHT}.`,
    perfectThirdMasculineSingular: `اِ${geminate("ث", FATHA)}خَنَ`,
    perfectFirstSingular: `اِ${geminate("ث", FATHA)}خَنْتُ`,
    imperativeSecondMasculineSingular: `اِ${geminate("ث", FATHA)}خِنْ`,
    imperfectThirdMasculineSingular: `يَ${geminate("ث", FATHA)}خِنُ`,
    masdar: `اِ${geminate("ث", KASRA)}خَان`,
    activeParticiple: `مُ${geminate("ث", FATHA)}خِن`,
    passiveParticiple: `مُ${geminate("ث", FATHA)}خَن`,
  },
  {
    id: "form-8-teh",
    root: "تبع",
    description: "",
    citationForm: "اِتَّبَعَ",
    gloss: "to follow",
    source: `${APPENDIX}: ت is in its list of triggering first radicals, so the infixed ـتـ merges with it into a geminate ت. Attested in Quran 2:120 (حَتَّىٰ تَتَّبِعَ). ${WRIGHT}.`,
    perfectThirdMasculineSingular: `اِ${geminate("ت", FATHA)}بَعَ`,
    perfectFirstSingular: `اِ${geminate("ت", FATHA)}بَعْتُ`,
    imperativeSecondMasculineSingular: `اِ${geminate("ت", FATHA)}بِعْ`,
    imperfectThirdMasculineSingular: `يَ${geminate("ت", FATHA)}بِعُ`,
    masdar: `اِ${geminate("ت", KASRA)}بَاع`,
    activeParticiple: `مُ${geminate("ت", FATHA)}بِع`,
    passiveParticiple: `مُ${geminate("ت", FATHA)}بَع`,
  },
  {
    id: "form-8-sad-final-weak",
    root: "صفو",
    description: "final-weak waw",
    citationForm: "اِصْطَفَى",
    gloss: "to choose",
    source: `${APPENDIX}: the form VIII assimilation rule applies to every form VIII verb whatever its other radicals, and اِصْطَفَى is the final-weak verb that carries it. Attested in Quran 2:130 (اصْطَفَيْنَاهُ). ${WRIGHT}, paradigm of the defective verb in form VIII.`,
    perfectThirdMasculineSingular: "اِصْطَفَى",
    perfectFirstSingular: "اِصْطَفَيْتُ",
    imperativeSecondMasculineSingular: "اِصْطَفِ",
    imperfectThirdMasculineSingular: "يَصْطَفِي",
    masdar: "اِصْطِفَاء",
    activeParticiple: "مُصْطَفٍ",
    passiveParticiple: "مُصْطَفًى",
  },
  {
    id: "form-8-dal-final-weak",
    root: "دعو",
    description: "final-weak waw",
    citationForm: "اِدَّعَى",
    gloss: "to claim",
    source: `${APPENDIX}: the form VIII assimilation rule applies to every form VIII verb whatever its other radicals, and اِدَّعَى is the final-weak verb that carries complete assimilation. Attested in Quran 41:31 (تَدَّعُونَ). ${WRIGHT}, paradigm of the defective verb in form VIII.`,
    perfectThirdMasculineSingular: `اِ${geminate("د", FATHA)}عَى`,
    perfectFirstSingular: `اِ${geminate("د", FATHA)}عَيْتُ`,
    imperativeSecondMasculineSingular: `اِ${geminate("د", FATHA)}عِ`,
    imperfectThirdMasculineSingular: `يَ${geminate("د", FATHA)}عِي`,
    masdar: `اِ${geminate("د", KASRA)}عَاء`,
    activeParticiple: `مُ${geminate("د", FATHA)}عٍ`,
    passiveParticiple: `مُ${geminate("د", FATHA)}عًى`,
  },
];
