import type { MetadataRoute } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { connection } from "next/server";
import { countSitemapPages, getSiteUrl, SITEMAP_PAGE_SIZE } from "~/app/site";
import { entryPath } from "~/lib/formatting";
import { getCachedSitemapSlugCount, getCachedSitemapSlugs } from "~/server/cache/public-queries";

const STATIC_PATHS: ReadonlyArray<{ path: string; priority: number }> = [
  { path: "/", priority: 1 },
  { path: "/lang/ar", priority: 0.8 },
  { path: "/lang/en", priority: 0.8 },
  { path: "/arabic-verb-form", priority: 0.7 },
  { path: "/appendix/arabic-verbs", priority: 0.6 },
];

export const generateSitemaps = async (): Promise<{ id: number }[]> => {
  const total = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD ? 0 : await getCachedSitemapSlugCount();
  return Array.from({ length: countSitemapPages(total) }, (_, id) => ({ id }));
};

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  await connection();
  const id = Number(await props.id);
  if (!Number.isInteger(id) || id < 0) {
    return [];
  }

  const siteUrl = getSiteUrl();
  const sitemapCount = countSitemapPages(await getCachedSitemapSlugCount());
  if (id >= sitemapCount) {
    return [];
  }
  const slugs = await getCachedSitemapSlugs(id * SITEMAP_PAGE_SIZE, SITEMAP_PAGE_SIZE);
  const staticPages =
    id === 0 ? STATIC_PATHS.map(({ path, priority }) => ({ url: `${siteUrl}${path}`, priority })) : [];

  return [...staticPages, ...slugs.map((slug) => ({ url: `${siteUrl}${entryPath(slug)}` }))];
}
