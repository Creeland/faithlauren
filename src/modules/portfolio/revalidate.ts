import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Revalidate every page whose content depends on a single portfolio, given the
 * public identifiers captured before/around a mutation. The admin detail page is
 * revalidated as the old action did; in addition — the point of owning
 * revalidation inside the module — the public pages that surface the portfolio
 * are revalidated too: the homepage (which lists group covers) and, when the
 * portfolio belongs to a group, the group's public page and this portfolio's
 * nested detail page. The old actions only refreshed the admin view, so a
 * change could sit stale on the public site; that gap closes here.
 *
 * The caller passes the slug/group up front because delete removes the row
 * before this runs — there is nothing left to look up afterward.
 */
export function revalidatePortfolio(target: {
  id: string;
  slug: string;
  groupSlug: string | null;
}): void {
  revalidatePath(`/admin/portfolios/${target.id}`);
  revalidatePath("/");
  if (target.groupSlug) {
    revalidatePath(`/portfolio/${target.groupSlug}`);
    revalidatePath(`/portfolio/${target.groupSlug}/${target.slug}`);
  }
}

/**
 * Look up the public identifiers a {@link revalidatePortfolio} call needs.
 * Returns null if the portfolio no longer exists.
 */
export async function loadPortfolioPaths(id: string): Promise<{
  id: string;
  slug: string;
  groupSlug: string | null;
} | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    select: { slug: true, group: { select: { slug: true } } },
  });
  if (!portfolio) return null;
  return { id, slug: portfolio.slug, groupSlug: portfolio.group?.slug ?? null };
}
