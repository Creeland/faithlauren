/**
 * Allowlist for server-side fetches of stored photo URLs.
 *
 * `photo.url` is admin-controlled (set at upload time from UploadThing's
 * `file.ufsUrl`), so SSRF risk is low. But the download route fetches these
 * URLs server-side, so we restrict them to the known upload/image hosts —
 * the same set declared as image `remotePatterns` in `next.config.ts`. A URL
 * pointing anywhere else (internal metadata endpoints, localhost, etc.) is
 * rejected before any request leaves the server.
 */

// Kept in sync with the `images.remotePatterns` hostnames in next.config.ts.
// A leading "*." denotes a single-level wildcard subdomain match.
const ALLOWED_PHOTO_HOST_PATTERNS = [
  "images.unsplash.com",
  "utfs.io",
  "*.ufs.sh",
] as const;

function hostMatches(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1); // ".ufs.sh"
    // Require at least one label before the suffix (no bare "ufs.sh"),
    // and only a single extra label to match Next.js' remotePattern semantics.
    if (!host.endsWith(suffix)) return false;
    const label = host.slice(0, host.length - suffix.length);
    return label.length > 0 && !label.includes(".");
  }
  return host === pattern;
}

/**
 * Returns true if `url` is a well-formed https URL whose host is on the
 * upload/image allowlist.
 */
export function isAllowedPhotoUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  return ALLOWED_PHOTO_HOST_PATTERNS.some((pattern) =>
    hostMatches(host, pattern),
  );
}
