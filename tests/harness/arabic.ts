const NAME_TABLE = [
  "0621 HAMZA",
  "0622 ALEF WITH MADDA ABOVE",
  "0623 ALEF WITH HAMZA ABOVE",
  "0624 WAW WITH HAMZA ABOVE",
  "0625 ALEF WITH HAMZA BELOW",
  "0626 YEH WITH HAMZA ABOVE",
  "0627 ALEF",
  "0628 BEH",
  "0629 TEH MARBUTA",
  "062A TEH",
  "062B THEH",
  "062C JEEM",
  "062D HAH",
  "062E KHAH",
  "062F DAL",
  "0630 THAL",
  "0631 REH",
  "0632 ZAIN",
  "0633 SEEN",
  "0634 SHEEN",
  "0635 SAD",
  "0636 DAD",
  "0637 TAH",
  "0638 ZAH",
  "0639 AIN",
  "063A GHAIN",
  "0640 TATWEEL",
  "0641 FEH",
  "0642 QAF",
  "0643 KAF",
  "0644 LAM",
  "0645 MEEM",
  "0646 NOON",
  "0647 HEH",
  "0648 WAW",
  "0649 ALEF MAKSURA",
  "064A YEH",
  "064B FATHATAN",
  "064C DAMMATAN",
  "064D KASRATAN",
  "064E FATHA",
  "064F DAMMA",
  "0650 KASRA",
  "0651 SHADDA",
  "0652 SUKUN",
  "0653 MADDAH ABOVE",
  "0654 HAMZA ABOVE",
  "0655 HAMZA BELOW",
  "0656 SUBSCRIPT ALEF",
  "0670 SUPERSCRIPT ALEF",
  "06CC FARSI YEH",
  "200C ZERO WIDTH NON-JOINER",
  "200D ZERO WIDTH JOINER",
  "200E LEFT-TO-RIGHT MARK",
  "200F RIGHT-TO-LEFT MARK",
  "0020 SPACE",
  "002D HYPHEN-MINUS",
];

const NAMES = new Map<number, string>(
  NAME_TABLE.map((entry) => {
    const [code, ...rest] = entry.split(" ");
    return [Number.parseInt(code ?? "", 16), rest.join(" ")];
  }),
);

const FSI = "⁨";
const PDI = "⁩";

export interface Codepoint {
  index: number;
  value: number;
  char: string;
  label: string;
}

export const codepointsOf = (text: string): Codepoint[] =>
  [...text].map((char, index) => {
    const value = char.codePointAt(0) ?? 0;
    const name = NAMES.get(value);
    const hex = `U+${value.toString(16).toUpperCase().padStart(4, "0")}`;
    return { index, value, char, label: name ? `${hex} ${name}` : hex };
  });

export const isolate = (text: string): string => `${FSI}${text}${PDI}`;

export const describeArabic = (text: string | null): string => {
  if (text === null) {
    return "NULL";
  }
  if (text === "") {
    return "(empty string)";
  }
  const points = codepointsOf(text);
  return `${isolate(text)}  [${points.map((point) => point.label).join(" | ")}]`;
};

export const firstDifference = (actual: string, expected: string): number | null => {
  const left = [...actual];
  const right = [...expected];
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      return index;
    }
  }
  return null;
};

const describeAt = (text: string, index: number): string => {
  const points = codepointsOf(text);
  const point = points[index];
  return point ? point.label : "(end of string)";
};

export const compareArabic = (actual: string | null, expected: string | null): string => {
  const lines = [`actual   ${describeArabic(actual)}`, `expected ${describeArabic(expected)}`];
  if (actual !== null && expected !== null) {
    const index = firstDifference(actual, expected);
    if (index !== null) {
      lines.push(
        `first difference at codepoint ${index}: actual ${describeAt(actual, index)} vs expected ${describeAt(expected, index)}`,
      );
    }
  }
  return lines.join("\n");
};

export const compareParadigm = (
  actual: Record<string, string | null>,
  expected: Record<string, string | null>,
): string[] => {
  const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort();
  const differences: string[] = [];
  for (const key of keys) {
    const left = actual[key] ?? null;
    const right = expected[key] ?? null;
    if (left !== right) {
      differences.push(`${key}\n${compareArabic(left, right)}`);
    }
  }
  return differences;
};
