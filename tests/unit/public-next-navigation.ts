export { notFound } from "next/dist/client/components/not-found.js";
export {
  getRedirectStatusCodeFromError,
  getURLFromRedirectError,
  permanentRedirect,
  redirect,
} from "next/dist/client/components/redirect.js";

export const useRouter = () => ({
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  refresh: () => undefined,
  prefetch: () => undefined,
});

export const usePathname = (): string => "/";

export const useSearchParams = (): URLSearchParams => new URLSearchParams();
