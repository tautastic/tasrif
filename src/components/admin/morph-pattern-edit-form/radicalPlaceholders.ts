const RAW_TO_DISPLAY: Record<string, string> = {
  "{1}": "ف",
  "{2}": "ع",
  "{3}": "ل",
};

const DISPLAY_TO_RAW: Record<string, string> = {
  ف: "{1}",
  ع: "{2}",
  ل: "{3}",
};

export const toDisplayTemplate = (raw: string): string =>
  raw.replace(/\{[123]\}/g, (match) => RAW_TO_DISPLAY[match] ?? match);

export const toRawTemplate = (display: string): string =>
  display.replace(/[فعل]/g, (match) => DISPLAY_TO_RAW[match] ?? match);
