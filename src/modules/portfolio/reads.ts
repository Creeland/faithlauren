import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * The public read side of the portfolio module: the queries behind the three
 * public pages (homepage "Selected Work", a group page, and an individual
 * portfolio page). Each returns a module-owned view type — plain shapes mapped
 * from the Prisma rows — so the pages never see Prisma-generated types and the
 * secret/admin-only columns never leave the module.
 *
 * The public ordering invariants live here and only here:
 *   - groups are listed by sortOrder ascending;
 *   - portfolios within a group are listed by sortOrder ascending;
 *   - photos within a portfolio are listed by sortOrder ascending
 *     (a portfolio's cover is its first photo in that order).
 */
const bySortOrder = { sortOrder: "asc" } as const;

/** A group as the homepage "Selected Work" grid renders it. */
export interface FrontPageGroup {
  title: string;
  slug: string;
  coverImageUrl: string;
  aspectRatio: string;
}

/** A portfolio as it appears in a group page's grid: its cover, or none. */
export interface GroupPortfolioCard {
  id: string;
  slug: string;
  title: string;
  aspectRatio: string;
  coverPhotoUrl: string | null;
}

/** A group as its public page renders it: header text plus its portfolios. */
export interface PortfolioGroupView {
  title: string;
  slug: string;
  description: string | null;
  portfolios: GroupPortfolioCard[];
}

/** A photo as the individual portfolio page renders it. */
export interface PortfolioPhotoView {
  id: string;
  url: string;
  filename: string;
  width: number | null;
  height: number | null;
}

/**
 * A single portfolio as its public page (or a direct/shared link) renders it.
 * `group` is null for an ungrouped portfolio reached by its direct URL.
 */
export interface PortfolioDetailView {
  title: string;
  slug: string;
  group: { slug: string; title: string } | null;
  photos: PortfolioPhotoView[];
}

/**
 * Groups shown on the front page: only those that contain at least one
 * portfolio and have a cover image, in sort order. The `coverImageUrl: not null`
 * filter guarantees a cover, so the view type exposes it as a non-null string
 * (the assertion is contained here rather than pushed onto the page).
 */
export async function getFrontPageGroups(): Promise<FrontPageGroup[]> {
  const groups = await prisma.portfolioGroup.findMany({
    where: {
      portfolios: { some: {} },
      coverImageUrl: { not: null },
    },
    orderBy: bySortOrder,
    select: {
      title: true,
      slug: true,
      coverImageUrl: true,
      aspectRatio: true,
    },
  });

  return groups.map((group) => ({
    title: group.title,
    slug: group.slug,
    coverImageUrl: group.coverImageUrl!,
    aspectRatio: group.aspectRatio,
  }));
}

/**
 * The public view of a group by slug, with its portfolios in order and each
 * portfolio's cover (its first photo), or `null` if no such group exists.
 */
export async function getPortfolioGroup(
  slug: string,
): Promise<PortfolioGroupView | null> {
  const group = await prisma.portfolioGroup.findUnique({
    where: { slug },
    select: {
      title: true,
      slug: true,
      description: true,
      portfolios: {
        orderBy: bySortOrder,
        select: {
          id: true,
          slug: true,
          title: true,
          aspectRatio: true,
          photos: {
            orderBy: bySortOrder,
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  });

  if (!group) return null;

  return {
    title: group.title,
    slug: group.slug,
    description: group.description,
    portfolios: group.portfolios.map((portfolio) => ({
      id: portfolio.id,
      slug: portfolio.slug,
      title: portfolio.title,
      aspectRatio: portfolio.aspectRatio,
      coverPhotoUrl: portfolio.photos[0]?.url ?? null,
    })),
  };
}

/**
 * The public view of a single portfolio by slug, with its photos in order and
 * its group (if any), or `null` if no such portfolio exists. Serves both the
 * nested portfolio page and the direct/shared-link fallback on the group page —
 * the caller decides, from `group`, whether to redirect to the canonical nested
 * URL or render the portfolio in place.
 */
export async function getPortfolioBySlug(
  slug: string,
): Promise<PortfolioDetailView | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { slug },
    select: {
      title: true,
      slug: true,
      group: { select: { slug: true, title: true } },
      photos: {
        orderBy: bySortOrder,
        select: {
          id: true,
          url: true,
          filename: true,
          width: true,
          height: true,
        },
      },
    },
  });

  if (!portfolio) return null;

  return {
    title: portfolio.title,
    slug: portfolio.slug,
    group: portfolio.group,
    photos: portfolio.photos,
  };
}

/**
 * The title/description a group page needs for its metadata, or `null` if no
 * such group exists. Kept separate from {@link getPortfolioGroup} so metadata
 * generation doesn't load the group's portfolios.
 */
export async function getGroupMeta(
  slug: string,
): Promise<{ title: string; description: string | null } | null> {
  return prisma.portfolioGroup.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });
}

/**
 * The title a portfolio page needs for its metadata, or `null` if no such
 * portfolio exists.
 */
export async function getPortfolioMeta(
  slug: string,
): Promise<{ title: string } | null> {
  return prisma.portfolio.findUnique({
    where: { slug },
    select: { title: true },
  });
}
