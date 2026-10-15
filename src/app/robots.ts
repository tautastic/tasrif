import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { countSitemapPages, getSiteUrl } from "~/app/site";
import { getCachedSitemapSlugCount } from "~/server/cache/public-queries";

const countSitemaps = async (): Promise<number> => {
  try {
    return countSitemapPages(await getCachedSitemapSlugCount());
  } catch {
    return 1;
  }
};

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const siteUrl = getSiteUrl();
  const sitemapCount = await countSitemaps();

  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/auth", "/api"] },
    sitemap: Array.from({ length: sitemapCount }, (_, id) => `${siteUrl}/sitemap/${id}.xml`),
  };
}
