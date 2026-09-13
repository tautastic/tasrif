export const isNonEmptyString = (s?: string | null): s is string => {
  return !!s && s !== "";
};
