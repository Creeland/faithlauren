import "server-only";

/**
 * Derive a URL slug from a human title: lowercase, collapse every run of
 * non-alphanumerics to a single dash, and trim leading/trailing dashes. This is
 * the gallery module's own copy of what the old action did inline; slug
 * generation is a gallery concern, so it lives with the gallery module rather
 * than in a shared util.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
