import { isIP } from "node:net";

const UNKNOWN_CLIENT = "unknown";

const parseIp = (value: string | null | undefined): string | null => {
  const candidate = value?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : null;
};

export const getClientIp = (headers: Pick<Headers, "get">): string => {
  const realIp = parseIp(headers.get("x-real-ip"));
  if (realIp) {
    return realIp;
  }
  return parseIp(headers.get("x-forwarded-for")?.split(",").at(-1)) ?? UNKNOWN_CLIENT;
};
