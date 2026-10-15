type CodePointRange = readonly [first: number, last?: number];

const characterClass = (ranges: readonly CodePointRange[]): string =>
  `[${ranges.map(([first, last = first]) => String.raw`\u{${first.toString(16)}}-\u{${last.toString(16)}}`).join("")}]`;

const VARIANT_LETTERS: ReadonlyMap<string, string> = new Map(
  (
    [
      [0x06cc, 0x064a],
      [0x06a9, 0x0643],
      [0x0671, 0x0627],
    ] as const
  ).map(([variant, canonical]) => [String.fromCodePoint(variant), String.fromCodePoint(canonical)]),
);

const STRIPPED_MARK_RANGES: readonly CodePointRange[] = [
  [0x0640],
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x0670],
  [0x06d6, 0x06dc],
  [0x06df, 0x06e4],
  [0x06e7, 0x06e8],
  [0x06ea, 0x06ed],
];

const SEPARATOR_RANGES: readonly CodePointRange[] = [
  [0x0009, 0x000d],
  [0x0020],
  [0x005f],
  [0x0085],
  [0x00a0],
  [0x1680],
  [0x180e],
  [0x2000, 0x200a],
  [0x2010, 0x2015],
  [0x2028, 0x2029],
  [0x202f],
  [0x205f],
  [0x2212],
  [0x3000],
];

const DROPPED_RANGES: readonly CodePointRange[] = [
  [0x0001, 0x0008],
  [0x000e, 0x001f],
  [0x0021, 0x002c],
  [0x002e, 0x002f],
  [0x003a, 0x0040],
  [0x005b, 0x005e],
  [0x0060],
  [0x007b, 0x00bf],
  [0x00d7],
  [0x00f7],
  [0x02b0, 0x02ff],
  [0x0600, 0x0605],
  [0x060c, 0x060f],
  [0x061b, 0x061f],
  [0x066a, 0x066d],
  [0x06d4],
  [0x06dd, 0x06de],
  [0x06e9],
  [0x200b, 0x200f],
  [0x2016, 0x2027],
  [0x202a, 0x202e],
  [0x2030, 0x205e],
  [0x2060, 0x206f],
  [0x20a0, 0x20cf],
  [0x2190, 0x2bff],
  [0x2e00, 0x2e7f],
  [0x3001, 0x303f],
  [0xe000, 0xf8ff],
  [0xfd3e, 0xfd3f],
  [0xfe00, 0xfe0f],
  [0xfeff],
  [0xfff0, 0xffff],
  [0x1f000, 0x1faff],
  [0xe0000, 0xe01ef],
];

const VARIANT_LETTER_PATTERN = new RegExp(`[${[...VARIANT_LETTERS.keys()].join("")}]`, "gu");
const STRIPPED_MARK_PATTERN = new RegExp(characterClass(STRIPPED_MARK_RANGES), "gu");
const SEPARATOR_PATTERN = new RegExp(`${characterClass(SEPARATOR_RANGES)}+`, "gu");
const DROPPED_PATTERN = new RegExp(characterClass(DROPPED_RANGES), "gu");

const lowerCodePoint = (character: string): string => {
  const lowered = Array.from(character.toLowerCase());
  return lowered[0] ?? character;
};

export const entrySlug = (input: string): string =>
  Array.from(input.normalize("NFKC"), lowerCodePoint)
    .join("")
    .replace(VARIANT_LETTER_PATTERN, (letter) => VARIANT_LETTERS.get(letter) ?? letter)
    .replace(STRIPPED_MARK_PATTERN, "")
    .replace(SEPARATOR_PATTERN, "-")
    .replace(DROPPED_PATTERN, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .normalize("NFKC");

export const lexicalEntrySlug = (id: number, text: string): string => entrySlug(text) || `e-${id}`;
