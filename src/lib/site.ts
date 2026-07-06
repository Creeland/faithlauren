/**
 * Canonical site identity used by SEO metadata, the sitemap, and robots.
 * The production origin is fixed here on purpose: preview deployments should
 * canonicalize to the real domain, not to their own URL.
 */
export const siteUrl = "https://faithlauren.photography";

export const siteName = "Faith Lauren Photography";

export const defaultTitle =
  "Faith Lauren Photography — Wichita Falls & North Texas Photographer";

export const siteDescription =
  "Portrait, family, wedding, and lifestyle photography by Faith Lauren — based in Wichita Falls, Texas and traveling throughout North Texas.";

/**
 * Meta description for a portfolio or group page that has no authored
 * description — keeps every indexable page location-aware.
 */
export function portfolioDescription(title: string): string {
  return `${title} photography by Faith Lauren — Wichita Falls, Texas photographer serving all of North Texas.`;
}

export type SocialProfile = { label: string; url: string | null };

/**
 * Public social profiles. A null url renders as plain text on the site and is
 * left out of structured data — never guess a handle here, or the site could
 * vouch for someone else's account. Fill in real profile URLs as Faith
 * confirms them.
 */
export const socialProfiles: SocialProfile[] = [
  { label: "Instagram", url: "https://www.instagram.com/mangoelephants" },
  { label: "Pinterest", url: null },
  { label: "TikTok", url: null },
];

/**
 * schema.org markup for the home page. ProfessionalService is the
 * LocalBusiness subtype that fits a service provider Google can rank in local
 * results; there is deliberately no street address (home-based business), so
 * areaServed carries the coverage instead.
 */
export function localBusinessJsonLd(
  profiles: SocialProfile[] = socialProfiles,
) {
  const sameAs = profiles.flatMap((p) => (p.url ? [p.url] : []));
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${siteUrl}/#business`,
    name: siteName,
    url: siteUrl,
    description: siteDescription,
    image: `${siteUrl}/faith.jpg`,
    founder: {
      "@type": "Person",
      name: "Faith Lauren",
      jobTitle: "Photographer",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Wichita Falls",
      addressRegion: "TX",
      addressCountry: "US",
    },
    areaServed: [
      { "@type": "City", name: "Wichita Falls" },
      { "@type": "Place", name: "North Texas" },
    ],
    knowsAbout: [
      "Portrait photography",
      "Family photography",
      "Wedding photography",
      "Lifestyle photography",
    ],
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}
