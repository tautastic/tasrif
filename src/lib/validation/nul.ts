const NUL = "\u0000";
const MAX_DEPTH = 8;

export const containsNul = (value: unknown, depth = 0): boolean => {
  if (typeof value === "string") {
    return value.includes(NUL);
  }
  if (depth >= MAX_DEPTH || typeof value !== "object" || value === null) {
    return false;
  }
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.some((child) => containsNul(child, depth + 1));
};
