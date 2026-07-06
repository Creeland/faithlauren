import { getSitemapEntries } from "@/modules/portfolio";
import { siteUrl } from "@/lib/site";

// A plain route handler instead of the sitemap.ts metadata convention:
// dynamic metadata sitemaps build fine but 404 on Vercel (metadata-route
// pipeline regression, see
// https://community.vercel.com/t/next-js-sitemap-xml-returns-404-on-vercel-production-with-dynamic-data/38411).
// ISR rather than force-dynamic for the same reason: Vercel misroutes
// dynamic function invocations on dotted paths (verified: next start serves
// this route, Vercel 404s it), while prerendered dotted paths like
// robots.txt serve fine. Hourly revalidation keeps new portfolios appearing
// without wiring sitemap revalidation into each portfolio mutation.
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const { groups, portfolios } = await getSitemapEntries();

  const entries: { loc: string; lastmod?: Date }[] = [
    { loc: siteUrl },
    ...groups.map((group) => ({
      loc: `${siteUrl}/portfolio/${group.slug}`,
      lastmod: group.updatedAt,
    })),
    ...portfolios.map((portfolio) => ({
      loc: `${siteUrl}/portfolio/${portfolio.groupSlug}/${portfolio.slug}`,
      lastmod: portfolio.updatedAt,
    })),
  ];

  const urls = entries
    .map(
      ({ loc, lastmod }) =>
        `<url><loc>${loc}</loc>${
          lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ""
        }</url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
