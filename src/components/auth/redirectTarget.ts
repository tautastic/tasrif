import { getSafeNextPath } from "~/lib/safe-next-path";

const cameFromAdminArea = (referrer: string, origin: string): boolean => {
  try {
    const url = new URL(referrer);
    return url.origin === origin && (url.pathname === "/admin" || url.pathname.startsWith("/admin/"));
  } catch {
    return false;
  }
};

export const resolveLoginRedirect = (next: string | null | undefined, referrer: string, origin: string): string =>
  getSafeNextPath(next) ?? (cameFromAdminArea(referrer, origin) ? "/admin" : "/");
