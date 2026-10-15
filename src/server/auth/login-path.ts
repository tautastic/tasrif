import { getSafeNextPath } from "~/lib/safe-next-path";

const LOGIN_PATH = "/auth/login";

export const ADMIN_PATH_HEADER = "x-admin-path";

export const buildLoginPath = (next?: string | null): string => {
  const safeNext = getSafeNextPath(next);
  return safeNext ? `${LOGIN_PATH}?next=${encodeURIComponent(safeNext)}` : LOGIN_PATH;
};
