export interface PatternVariantOption {
  id: number;
  variant: string | null;
  description: string;
  note: string | null;
  sample: string | null;
  isDefault: boolean;
}

export interface PatternVariantsResponse {
  variants: PatternVariantOption[];
  current: number | null;
}

export const formatPatternVariantLabel = (option: PatternVariantOption): string => {
  const name = option.variant ?? "Default";
  const description = option.description ? ` (${option.description})` : "";
  return option.sample ? `${name}${description}: ${option.sample}` : `${name}${description}`;
};
