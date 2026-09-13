import rawContent from "./arabic-verbs.json";

export interface ArabicRefData {
  arabic: string;
  href?: string | null;
  transliteration?: string;
  gloss?: string;
  literal?: string;
  cf?: ArabicRefData;
}

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "italic"; value: string }
  | ({ type: "ref" } & ArabicRefData);

export interface TableHeaderCell {
  content: string;
  colSpan?: number;
}

export interface TableCell {
  content: InlineNode[];
  rowSpan?: number;
  align?: "center";
}

export interface TableRow {
  cells: TableCell[];
}

export interface MeaningItemData {
  label: string;
  arabic?: string;
  transliteration?: string;
  description: string;
  items: InlineNode[][];
}

export type BlockNode =
  | { type: "heading"; title: string }
  | { type: "mainCategory"; href: string; label: string }
  | { type: "paragraph"; content: InlineNode[] }
  | { type: "examples"; items: InlineNode[][] }
  | { type: "table"; headers: TableHeaderCell[]; rows: TableRow[] }
  | { type: "meaningList"; items: MeaningItemData[] };

interface ContentFile {
  _license: string;
  _source: string;
  _note: string;
  content: BlockNode[];
}

const file = rawContent as unknown as ContentFile;

export const arabicVerbs = file.content;
