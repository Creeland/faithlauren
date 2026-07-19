import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ReorderItem } from "@/lib/reorder";
import { DuplicateSlugError } from "@/modules/shared/errors";
import { deleteAllPhotos } from "@/modules/photos";
import { slugify } from "./slug";
import { loadPortfolioPaths, revalidatePortfolio } from "./revalidate";

/**
 * The portfolio module: one interface over the admin portfolio lifecycle —
 * create, update, delete, and reorder. Slug generation and uniqueness live
 * here; photo file cleanup on delete is delegated to the photos module; each
 * mutation revalidates the paths it affects. The action layer only parses the
 * form and maps the module's typed failures onto form state. (Portfolio groups
 * will join this module in the next slice.)
 */

export interface PortfolioInput {
  title: string;
  /** Public SEO text; `null` clears it, absent leaves the stored value alone. */
  description?: string | null;
}

/**
 * Create a portfolio from an admin's title. The slug is derived from the title;
 * a collision throws {@link DuplicateSlugError} for the action to map to its
 * form-error message. The new portfolio is appended at the end (its sortOrder is
 * one past the current max). Revalidates the admin list so the new row appears.
 */
export async function createPortfolio(
  input: PortfolioInput,
): Promise<{ id: string }> {
  const slug = slugify(input.title);

  const existing = await prisma.portfolio.findUnique({ where: { slug } });
  if (existing) throw new DuplicateSlugError(slug);

  const maxSort = await prisma.portfolio.aggregate({
    _max: { sortOrder: true },
  });

  const portfolio = await prisma.portfolio.create({
    data: {
      title: input.title,
      slug,
      description: input.description,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  revalidatePath("/admin/portfolios");
  return { id: portfolio.id };
}

/**
 * Update a portfolio's title and description. The slug is intentionally left
 * unchanged (as the old action did), so the client-facing URL is stable across
 * renames. Revalidates the admin detail page and the public pages that surface
 * the portfolio's title.
 */
export async function updatePortfolio(
  id: string,
  input: PortfolioInput,
): Promise<void> {
  await prisma.portfolio.update({
    where: { id },
    data: { title: input.title, description: input.description },
  });

  const paths = await loadPortfolioPaths(id);
  if (paths) revalidatePortfolio(paths);
}

/**
 * Delete a portfolio and everything under it. Its photos' stored files and rows
 * are removed by delegating to the photos module ({@link deleteAllPhotos});
 * the portfolio row itself is then deleted. The public identifiers are captured
 * before deletion so the affected pages can be revalidated afterward, plus the
 * admin list. (The DB-level cascade would drop the photo rows anyway, but the
 * UploadThing files would be orphaned — the module owns that cleanup.)
 */
export async function deletePortfolio(id: string): Promise<void> {
  const paths = await loadPortfolioPaths(id);

  await deleteAllPhotos({ portfolio: id });
  await prisma.portfolio.delete({ where: { id } });

  revalidatePath("/admin/portfolios");
  revalidatePath("/");
  if (paths?.groupSlug) {
    revalidatePath(`/portfolio/${paths.groupSlug}`);
  }
}

/**
 * Persist a new sort order for a set of portfolios, in one transaction (as the
 * old action did, now atomic). Revalidates the admin list and — since portfolio
 * order drives the public group page and homepage layout — the affected public
 * pages: the homepage and each distinct group page the reordered portfolios
 * belong to.
 */
export async function reorderPortfolios(order: ReorderItem[]): Promise<void> {
  await prisma.$transaction(
    order.map((item) =>
      prisma.portfolio.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );

  revalidatePath("/admin/portfolios");
  revalidatePath("/");

  const portfolios = await prisma.portfolio.findMany({
    where: { id: { in: order.map((item) => item.id) } },
    select: { group: { select: { slug: true } } },
  });
  const groupSlugs = new Set(
    portfolios
      .map((p) => p.group?.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );
  for (const slug of groupSlugs) {
    revalidatePath(`/portfolio/${slug}`);
  }
}

/**
 * Set a portfolio's cover photo, optionally recording the aspect ratio the
 * admin chose alongside it (an empty ratio leaves the stored one untouched, as
 * the old action did). Revalidates the admin detail page and the homepage —
 * exactly the paths the old action refreshed. This is a cover concern rather
 * than part of the create/update/delete lifecycle, so it revalidates narrowly
 * rather than through {@link revalidatePortfolio}.
 */
export async function setCoverPhoto(
  portfolioId: string,
  photoId: string,
  aspectRatio?: string | null,
): Promise<void> {
  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: {
      coverPhotoId: photoId,
      ...(aspectRatio && { aspectRatio }),
    },
  });

  revalidatePath(`/admin/portfolios/${portfolioId}`);
  revalidatePath("/");
}
