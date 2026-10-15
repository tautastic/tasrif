const ESCAPE = "\\";

const TRILITERAL_PLACEHOLDER_BY_LETTER: Record<string, string> = {
  ف: "{1}",
  ع: "{2}",
  ل: "{3}",
};

const QUADRILITERAL_PLACEHOLDER_BY_LETTER: Record<string, string> = {
  ...TRILITERAL_PLACEHOLDER_BY_LETTER,
  ق: "{4}",
};

const PLACEHOLDER_LENGTH = 3;

const placeholdersFor = (radicalCount: number): Record<string, string> =>
  radicalCount === 4 ? QUADRILITERAL_PLACEHOLDER_BY_LETTER : TRILITERAL_PLACEHOLDER_BY_LETTER;

const lettersFor = (radicalCount: number): Record<string, string> =>
  Object.fromEntries(
    Object.entries(placeholdersFor(radicalCount)).map(([letter, placeholder]) => [placeholder, letter]),
  );

export const toRawTemplate = (display: string, radicalCount = 3): string => {
  const placeholderByLetter = placeholdersFor(radicalCount);
  let raw = "";
  let backslashes = 0;
  for (const char of display) {
    if (char === ESCAPE) {
      backslashes += 1;
      continue;
    }
    const placeholder = placeholderByLetter[char];
    if (placeholder === undefined) {
      raw += ESCAPE.repeat(backslashes) + char;
    } else {
      const isEscaped = backslashes % 2 === 1;
      raw += ESCAPE.repeat(Math.floor(backslashes / 2)) + (isEscaped ? char : placeholder);
    }
    backslashes = 0;
  }
  return raw + ESCAPE.repeat(backslashes);
};

export const toDisplayTemplate = (raw: string, radicalCount = 3): string => {
  const placeholderByLetter = placeholdersFor(radicalCount);
  const letterByPlaceholder = lettersFor(radicalCount);
  let display = "";
  let backslashes = 0;
  let index = 0;
  while (index < raw.length) {
    const char = raw.charAt(index);
    if (char === ESCAPE) {
      backslashes += 1;
      index += 1;
      continue;
    }
    const letter = letterByPlaceholder[raw.slice(index, index + PLACEHOLDER_LENGTH)];
    if (letter !== undefined) {
      display += ESCAPE.repeat(backslashes * 2) + letter;
      index += PLACEHOLDER_LENGTH;
    } else if (placeholderByLetter[char] !== undefined) {
      display += ESCAPE.repeat(backslashes * 2 + 1) + char;
      index += 1;
    } else {
      display += ESCAPE.repeat(backslashes) + char;
      index += 1;
    }
    backslashes = 0;
  }
  return display + ESCAPE.repeat(backslashes);
};
