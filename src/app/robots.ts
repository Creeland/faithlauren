import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// /gallery is deliberately not disallowed: those pages carry a noindex robots
// meta tag, which crawlers can only honor if they are allowed to fetch the
// page — blocking them here would leave leaked gallery URLs indexed as bare
// links.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/login"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
