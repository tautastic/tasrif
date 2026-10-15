import type { Metadata } from "next";

export const SITE_NAME = "Tasrif";
export const SITE_DESCRIPTION = "Arabic morphological engine and English–Arabic dictionary";
export const SITEMAP_PAGE_SIZE = 5000;

const DEFAULT_SITE_URL = "https://tasrif.xyz";

export const countSitemapPages = (totalSlugs: number): number => Math.max(1, Math.ceil(totalSlugs / SITEMAP_PAGE_SIZE));

export const getSiteUrl = (): string => {
  try {
    return new URL(process.env.SITE_URL?.trim() || DEFAULT_SITE_URL).toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
};

interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}

export const buildPageMetadata = ({ title, description, path, noIndex = false }: PageMetadataInput): Metadata => ({
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${title} — ${SITE_NAME}`,
    description,
    url: path,
  },
  ...(noIndex ? { robots: { index: false, follow: true } } : {}),
});

export const DEFAULT_OPEN_GRAPH: NonNullable<Metadata["openGraph"]> = {
  type: "website",
  siteName: SITE_NAME,
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: "/",
};
