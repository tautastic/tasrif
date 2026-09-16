export const HAMZA = "ء";
export const ALEF_MADDA = "آ";
export const ALEF_HAMZA_ABOVE = "أ";
export const WAW_HAMZA = "ؤ";
export const ALEF_HAMZA_BELOW = "إ";
export const YEH_HAMZA = "ئ";
export const ALEF = "ا";
export const BEH = "ب";
export const TEH = "ت";
export const DAL = "د";
export const REH = "ر";
export const SEEN = "س";
export const GHAIN = "غ";
export const TATWEEL = "ـ";
export const FEH = "ف";
export const JEEM = "ج";
export const KAF = "ك";
export const LAM = "ل";
export const MEEM = "م";
export const NOON = "ن";
export const WAW = "و";
export const ALEF_MAKSURA = "ى";
export const YEH = "ي";
export const FARSI_YEH = "ی";
export const FATHA = "َ";
export const DAMMA = "ُ";
export const KASRA = "ِ";
export const KASRATAN = "ٍ";
export const SHADDA = "ّ";
export const SUKUN = "ْ";
export const ZWJ = "‍";

export interface NormalizationCase {
  name: string;
  input: string;
  expected: string;
}

export interface FunctionCases {
  fn: string;
  cases: NormalizationCase[];
}

const removeTatweel: FunctionCases = {
  fn: "normalize_arabic_remove_tatweel",
  cases: [
    {
      name: "strips a tatweel between two letters",
      input: KAF + TATWEEL + TEH + BEH,
      expected: KAF + TEH + BEH,
    },
    {
      name: "strips a run of repeated tatweels",
      input: KAF + TATWEEL + TATWEEL + TATWEEL + TEH,
      expected: KAF + TEH,
    },
    {
      name: "strips a leading tatweel",
      input: TATWEEL + KAF + TEH,
      expected: KAF + TEH,
    },
    {
      name: "strips a trailing tatweel",
      input: KAF + TEH + TATWEEL,
      expected: KAF + TEH,
    },
    {
      name: "strips a tatweel wedged between a letter and its diacritic",
      input: KAF + TATWEEL + FATHA + TEH,
      expected: KAF + FATHA + TEH,
    },
    {
      name: "leaves a vocalised word without tatweel untouched",
      input: KAF + FATHA + TEH + FATHA + BEH,
      expected: KAF + FATHA + TEH + FATHA + BEH,
    },
    {
      name: "keeps alef, which is a letter rather than a stretch mark",
      input: ALEF + LAM + KAF,
      expected: ALEF + LAM + KAF,
    },
    {
      name: "keeps a zero width joiner",
      input: KAF + ZWJ + TEH,
      expected: KAF + ZWJ + TEH,
    },
  ],
};

const alefMaqsura: FunctionCases = {
  fn: "normalize_arabic_alef_maqsura",
  cases: [
    {
      name: "rewrites a standalone farsi yeh to alef maksura",
      input: FARSI_YEH,
      expected: ALEF_MAKSURA,
    },
    {
      name: "rewrites every farsi yeh in the string",
      input: FARSI_YEH + LAM + FARSI_YEH,
      expected: ALEF_MAKSURA + LAM + ALEF_MAKSURA,
    },
    {
      name: "rewrites a farsi yeh at the end of a word",
      input: REH + MEEM + FARSI_YEH,
      expected: REH + MEEM + ALEF_MAKSURA,
    },
    {
      name: "leaves an existing alef maksura untouched",
      input: REH + MEEM + ALEF_MAKSURA,
      expected: REH + MEEM + ALEF_MAKSURA,
    },
    {
      name: "leaves arabic yeh untouched even though it looks identical in final position",
      input: REH + MEEM + YEH,
      expected: REH + MEEM + YEH,
    },
  ],
};

const initialHamza: FunctionCases = {
  fn: "normalize_arabic_initial_hamza",
  cases: [
    {
      name: "seats an initial hamza carrying fatha on alef",
      input: HAMZA + FATHA + KAF + LAM,
      expected: ALEF_HAMZA_ABOVE + FATHA + KAF + LAM,
    },
    {
      name: "seats an initial hamza carrying damma on alef",
      input: HAMZA + DAMMA + KAF + LAM,
      expected: ALEF_HAMZA_ABOVE + DAMMA + KAF + LAM,
    },
    {
      name: "seats an initial hamza carrying kasra on alef with hamza below",
      input: HAMZA + KASRA + SEEN + LAM,
      expected: ALEF_HAMZA_BELOW + KASRA + SEEN + LAM,
    },
    {
      name: "ignores a vowelled hamza that is not at the start of the string",
      input: KAF + HAMZA + FATHA + LAM,
      expected: KAF + HAMZA + FATHA + LAM,
    },
    {
      name: "ignores an initial hamza carrying sukun",
      input: HAMZA + SUKUN + KAF,
      expected: HAMZA + SUKUN + KAF,
    },
    {
      name: "ignores an initial hamza whose vowel is separated by a shadda",
      input: HAMZA + SHADDA + FATHA + KAF,
      expected: HAMZA + SHADDA + FATHA + KAF,
    },
    {
      name: "leaves an already seated initial hamza untouched",
      input: ALEF_HAMZA_ABOVE + FATHA + KAF,
      expected: ALEF_HAMZA_ABOVE + FATHA + KAF,
    },
  ],
};

const gemination: FunctionCases = {
  fn: "normalize_arabic_gemination",
  cases: [
    {
      name: "collapses a sukun doubled consonant into a shadda",
      input: MEEM + FATHA + DAL + SUKUN + DAL,
      expected: MEEM + FATHA + DAL + SHADDA,
    },
    {
      name: "collapses hamza, the first letter of the matched range",
      input: HAMZA + SUKUN + HAMZA,
      expected: HAMZA + SHADDA,
    },
    {
      name: "collapses ghain, the last letter of the first matched range",
      input: GHAIN + SUKUN + GHAIN,
      expected: GHAIN + SHADDA,
    },
    {
      name: "collapses feh, the first letter of the second matched range",
      input: FEH + SUKUN + FEH,
      expected: FEH + SHADDA,
    },
    {
      name: "collapses yeh, the last letter of the second matched range",
      input: YEH + SUKUN + YEH,
      expected: YEH + SHADDA,
    },
    {
      name: "collapses every doubled consonant in the string",
      input: DAL + SUKUN + DAL + LAM + BEH + SUKUN + BEH,
      expected: DAL + SHADDA + LAM + BEH + SHADDA,
    },
    {
      name: "consumes only the first pair when the same letter is chained three times",
      input: DAL + SUKUN + DAL + SUKUN + DAL,
      expected: DAL + SHADDA + SUKUN + DAL,
    },
    {
      name: "leaves two different consonants separated by sukun alone",
      input: BEH + SUKUN + TEH,
      expected: BEH + SUKUN + TEH,
    },
    {
      name: "leaves tatweel alone because the letter range deliberately skips it",
      input: TATWEEL + SUKUN + TATWEEL,
      expected: TATWEEL + SUKUN + TATWEEL,
    },
    {
      name: "leaves a doubled letter written without a sukun alone",
      input: DAL + DAL,
      expected: DAL + DAL,
    },
    {
      name: "leaves an ordinary vocalised word untouched",
      input: KAF + FATHA + TEH + FATHA + BEH,
      expected: KAF + FATHA + TEH + FATHA + BEH,
    },
  ],
};

const hamzaAssimilation: FunctionCases = {
  fn: "normalize_arabic_hamza_assimilation",
  cases: [
    {
      name: "merges a hamza-fatha hamza-sukun sequence into alef madda",
      input: ALEF_HAMZA_ABOVE + FATHA + ALEF_HAMZA_ABOVE + SUKUN,
      expected: ALEF_MADDA,
    },
    {
      name: "merges a hamza-fatha followed by alef into alef madda",
      input: ALEF_HAMZA_ABOVE + FATHA + ALEF,
      expected: ALEF_MADDA,
    },
    {
      name: "merges inside a word rather than only at the start",
      input: KAF + ALEF_HAMZA_ABOVE + FATHA + ALEF + LAM,
      expected: KAF + ALEF_MADDA + LAM,
    },
    {
      name: "applies the sukun rule first and leaves a following alef standing",
      input: ALEF_HAMZA_ABOVE + FATHA + ALEF_HAMZA_ABOVE + SUKUN + ALEF,
      expected: ALEF_MADDA + ALEF,
    },
    {
      name: "ignores a hamza-fatha followed by a hamza carrying another fatha",
      input: ALEF_HAMZA_ABOVE + FATHA + ALEF_HAMZA_ABOVE + FATHA,
      expected: ALEF_HAMZA_ABOVE + FATHA + ALEF_HAMZA_ABOVE + FATHA,
    },
    {
      name: "leaves an existing alef madda untouched",
      input: ALEF_MADDA + KAF,
      expected: ALEF_MADDA + KAF,
    },
  ],
};

const hamzaSeatingAlif: FunctionCases = {
  fn: "normalize_arabic_hamza_seating_alif",
  cases: [
    {
      name: "reseats a quiescent hamza on yeh after alef with kasra",
      input: ALEF + KASRA + ALEF_HAMZA_ABOVE + SUKUN,
      expected: ALEF + KASRA + YEH_HAMZA + SUKUN,
    },
    {
      name: "reseats a quiescent hamza on waw after alef with damma",
      input: ALEF + DAMMA + ALEF_HAMZA_ABOVE + SUKUN,
      expected: ALEF + DAMMA + WAW_HAMZA + SUKUN,
    },
    {
      name: "ignores alef with fatha before a quiescent hamza",
      input: ALEF + FATHA + ALEF_HAMZA_ABOVE + SUKUN,
      expected: ALEF + FATHA + ALEF_HAMZA_ABOVE + SUKUN,
    },
    {
      name: "ignores alef with kasra before a hamza that carries a vowel",
      input: ALEF + KASRA + ALEF_HAMZA_ABOVE + FATHA,
      expected: ALEF + KASRA + ALEF_HAMZA_ABOVE + FATHA,
    },
    {
      name: "leaves an already reseated yeh hamza untouched",
      input: ALEF + KASRA + YEH_HAMZA + SUKUN,
      expected: ALEF + KASRA + YEH_HAMZA + SUKUN,
    },
  ],
};

const hamzaSeatingBare: FunctionCases = {
  fn: "normalize_arabic_hamza_seating_bare",
  cases: [
    {
      name: "seats a bare hamza on alef after a fatha",
      input: KAF + FATHA + HAMZA,
      expected: KAF + FATHA + ALEF_HAMZA_ABOVE,
    },
    {
      name: "seats a bare hamza on waw after a damma",
      input: KAF + DAMMA + HAMZA,
      expected: KAF + DAMMA + WAW_HAMZA,
    },
    {
      name: "seats a bare hamza on yeh after a kasra",
      input: KAF + KASRA + HAMZA,
      expected: KAF + KASRA + YEH_HAMZA,
    },
    {
      name: "keeps a shadda standing between a fatha and the seated hamza",
      input: KAF + FATHA + SHADDA + HAMZA,
      expected: KAF + FATHA + SHADDA + ALEF_HAMZA_ABOVE,
    },
    {
      name: "keeps a shadda standing between a damma and the seated hamza",
      input: KAF + DAMMA + SHADDA + HAMZA,
      expected: KAF + DAMMA + SHADDA + WAW_HAMZA,
    },
    {
      name: "keeps a shadda standing between a kasra and the seated hamza",
      input: KAF + KASRA + SHADDA + HAMZA,
      expected: KAF + KASRA + SHADDA + YEH_HAMZA,
    },
    {
      name: "seats every bare hamza in the string on its own vowel",
      input: KAF + FATHA + HAMZA + LAM + KASRA + HAMZA,
      expected: KAF + FATHA + ALEF_HAMZA_ABOVE + LAM + KASRA + YEH_HAMZA,
    },
    {
      name: "ignores a hamza that follows a sukun",
      input: KAF + SUKUN + HAMZA,
      expected: KAF + SUKUN + HAMZA,
    },
    {
      name: "ignores a hamza with no preceding vowel at all",
      input: KAF + HAMZA,
      expected: KAF + HAMZA,
    },
    {
      name: "ignores a hamza preceded by a shadda without a vowel",
      input: KAF + SHADDA + HAMZA,
      expected: KAF + SHADDA + HAMZA,
    },
  ],
};

const hamzaSeatingWawYeh: FunctionCases = {
  fn: "normalize_arabic_hamza_seating_waw_yeh",
  cases: [
    {
      name: "reseats alef hamza on waw before a long u",
      input: ALEF_HAMZA_ABOVE + DAMMA + WAW,
      expected: WAW_HAMZA + DAMMA + WAW,
    },
    {
      name: "reseats alef hamza on yeh before a long i",
      input: ALEF_HAMZA_ABOVE + KASRA + YEH,
      expected: YEH_HAMZA + KASRA + YEH,
    },
    {
      name: "ignores alef hamza with damma followed by yeh",
      input: ALEF_HAMZA_ABOVE + DAMMA + YEH,
      expected: ALEF_HAMZA_ABOVE + DAMMA + YEH,
    },
    {
      name: "ignores alef hamza with fatha followed by waw",
      input: ALEF_HAMZA_ABOVE + FATHA + WAW,
      expected: ALEF_HAMZA_ABOVE + FATHA + WAW,
    },
    {
      name: "leaves an already reseated waw hamza untouched",
      input: WAW_HAMZA + DAMMA + WAW,
      expected: WAW_HAMZA + DAMMA + WAW,
    },
  ],
};

const hamzaSeatingAfterAlif: FunctionCases = {
  fn: "normalize_arabic_hamza_seating_after_alif",
  cases: [
    {
      name: "seats a medial hamza carrying kasra on a yeh after a long alef",
      input: SEEN + FATHA + ALEF + ALEF_HAMZA_ABOVE + KASRA + LAM,
      expected: SEEN + FATHA + ALEF + YEH_HAMZA + KASRA + LAM,
    },
    {
      name: "seats a medial bare hamza carrying kasra on a yeh after a long alef",
      input: SEEN + FATHA + ALEF + HAMZA + KASRA + LAM,
      expected: SEEN + FATHA + ALEF + YEH_HAMZA + KASRA + LAM,
    },
    {
      name: "seats a medial hamza carrying damma on a waw after a long alef",
      input: TEH + FATHA + SEEN + FATHA + ALEF + ALEF_HAMZA_ABOVE + DAMMA + LAM,
      expected: TEH + FATHA + SEEN + FATHA + ALEF + WAW_HAMZA + DAMMA + LAM,
    },
    {
      name: "leaves a word final hamza after a long alef on the line",
      input: SEEN + FATHA + MEEM + FATHA + ALEF + HAMZA + KASRA,
      expected: SEEN + FATHA + MEEM + FATHA + ALEF + HAMZA + KASRA,
    },
    {
      name: "leaves a hamza carrying fatha after a long alef alone",
      input: JEEM + FATHA + ALEF + HAMZA + FATHA,
      expected: JEEM + FATHA + ALEF + HAMZA + FATHA,
    },
    {
      name: "leaves a hamza that does not follow a long alef alone",
      input: SEEN + FATHA + HAMZA + KASRA + LAM,
      expected: SEEN + FATHA + HAMZA + KASRA + LAM,
    },
    {
      name: "writes a medial hamza carrying fatha after a long alef on the line",
      input: SEEN + FATHA + ALEF + ALEF_HAMZA_ABOVE + FATHA + LAM,
      expected: SEEN + FATHA + ALEF + HAMZA + FATHA + LAM,
    },
    {
      name: "writes a word final hamza carrying kasratan after a long alef on the line",
      input: NOON + FATHA + ALEF + ALEF_HAMZA_ABOVE + KASRATAN,
      expected: NOON + FATHA + ALEF + HAMZA + KASRATAN,
    },
    {
      name: "writes an undiacritised word final hamza after a long alef on the line",
      input: BEH + KASRA + NOON + FATHA + ALEF + ALEF_HAMZA_ABOVE,
      expected: BEH + KASRA + NOON + FATHA + ALEF + HAMZA,
    },
    {
      name: "writes a word final yeh hamza after a long alef on the line",
      input: NOON + FATHA + ALEF + YEH_HAMZA + KASRATAN,
      expected: NOON + FATHA + ALEF + HAMZA + KASRATAN,
    },
    {
      name: "leaves a word final hamza that does not follow a long alef alone",
      input: SEEN + FATHA + TEH + KASRA + YEH_HAMZA,
      expected: SEEN + FATHA + TEH + KASRA + YEH_HAMZA,
    },
  ],
};

const longVowels: FunctionCases = {
  fn: "normalize_arabic_long_vowels",
  cases: [
    {
      name: "drops the redundant sukun from a damma waw long vowel",
      input: KAF + DAMMA + WAW + SUKUN,
      expected: KAF + DAMMA + WAW,
    },
    {
      name: "drops the redundant sukun from a kasra yeh long vowel",
      input: KAF + KASRA + YEH + SUKUN,
      expected: KAF + KASRA + YEH,
    },
    {
      name: "keeps the sukun that marks a fatha waw diphthong",
      input: KAF + FATHA + WAW + SUKUN,
      expected: KAF + FATHA + WAW + SUKUN,
    },
    {
      name: "keeps the sukun that marks a fatha yeh diphthong",
      input: KAF + FATHA + YEH + SUKUN,
      expected: KAF + FATHA + YEH + SUKUN,
    },
    {
      name: "keeps a damma yeh sukun sequence, which is not a long vowel",
      input: KAF + DAMMA + YEH + SUKUN,
      expected: KAF + DAMMA + YEH + SUKUN,
    },
    {
      name: "leaves a damma waw written without a sukun untouched",
      input: KAF + DAMMA + WAW,
      expected: KAF + DAMMA + WAW,
    },
  ],
};

export const FUNCTION_CASES: FunctionCases[] = [
  removeTatweel,
  alefMaqsura,
  initialHamza,
  gemination,
  hamzaAssimilation,
  hamzaSeatingAlif,
  hamzaSeatingBare,
  hamzaSeatingWawYeh,
  hamzaSeatingAfterAlif,
  longVowels,
];

export interface PipelineCase extends NormalizationCase {
  ordering?: { earlier: string; later: string };
}

export const PIPELINE_CASES: PipelineCase[] = [
  {
    name: "removes tatweel before geminating, so a stretch mark cannot block a shadda",
    input: DAL + SUKUN + TATWEEL + DAL,
    expected: DAL + SHADDA,
    ordering: { earlier: "normalize_arabic_remove_tatweel", later: "normalize_arabic_gemination" },
  },
  {
    name: "normalises farsi yeh before geminating, so the letter range can match it",
    input: FARSI_YEH + SUKUN + FARSI_YEH,
    expected: ALEF_MAKSURA + SHADDA,
    ordering: { earlier: "normalize_arabic_alef_maqsura", later: "normalize_arabic_gemination" },
  },
  {
    name: "seats an initial hamza before reseating it on waw",
    input: HAMZA + DAMMA + WAW,
    expected: WAW_HAMZA + DAMMA + WAW,
    ordering: { earlier: "normalize_arabic_initial_hamza", later: "normalize_arabic_hamza_seating_waw_yeh" },
  },
  {
    name: "seats a bare hamza before assimilating the pair into alef madda",
    input: ALEF_HAMZA_ABOVE + FATHA + HAMZA + SUKUN,
    expected: ALEF_MADDA,
    ordering: { earlier: "normalize_arabic_hamza_seating_bare", later: "normalize_arabic_hamza_assimilation" },
  },
  {
    name: "geminates before shortening long vowels, so a doubled waw stays geminated",
    input: KAF + DAMMA + WAW + SUKUN + WAW,
    expected: KAF + DAMMA + WAW + SHADDA,
    ordering: { earlier: "normalize_arabic_gemination", later: "normalize_arabic_long_vowels" },
  },
  {
    name: "cleans a form I perfect that carries a decorative tatweel",
    input: KAF + FATHA + TEH + FATHA + BEH + SUKUN + TATWEEL + TEH + DAMMA,
    expected: KAF + FATHA + TEH + FATHA + BEH + SUKUN + TEH + DAMMA,
  },
  {
    name: "leaves a fully normalised form I perfect unchanged",
    input: KAF + FATHA + TEH + FATHA + BEH + FATHA,
    expected: KAF + FATHA + TEH + FATHA + BEH + FATHA,
  },
];

export const ALL_FUNCTIONS: string[] = [...FUNCTION_CASES.map((group) => group.fn), "normalize_arabic_orthography"];
