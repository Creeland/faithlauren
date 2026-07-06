import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/modules/portfolio";
import { siteUrl } from "@/lib/site";

// Recomputed on every fetch so new portfolios appear without wiring sitemap
// revalidation into each portfolio mutation; crawlers request this rarely.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { groups, portfolios } = await getSitemapEntries();

  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    ...groups.map((group) => ({
      url: `${siteUrl}/portfolio/${group.slug}`,
      lastModified: group.updatedAt,
    })),
    ...portfolios.map((portfolio) => ({
      url: `${siteUrl}/portfolio/${portfolio.groupSlug}/${portfolio.slug}`,
      lastModified: portfolio.updatedAt,
    })),
  ];
}
