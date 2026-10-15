const LOCAL_ORIGIN = "http://local.invalid";

const hasForbiddenCharacter = (value: string): boolean =>
  [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f || char === "\\";
  });

export const getSafeNextPath = (next: string | null | undefined): string | null => {
  if (!next?.startsWith("/") || next.startsWith("//") || hasForbiddenCharacter(next)) {
    return null;
  }
  try {
    return new URL(next, LOCAL_ORIGIN).origin === LOCAL_ORIGIN ? next : null;
  } catch {
    return null;
  }
};
