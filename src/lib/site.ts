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
