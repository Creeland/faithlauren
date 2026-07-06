import "server-only";

/**
 * Derive a URL slug from a human title: lowercase, collapse every run of
 * non-alphanumerics to a single dash, and trim leading/trailing dashes. This is
 * the portfolio module's own copy of what the old action did inline; slug
 * generation is a portfolio concern, so it lives with the portfolio module
 * rather than in a shared util. (Identical in spirit to the gallery module's
 * slug helper — the two entities keep their own copies rather than coupling.)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
