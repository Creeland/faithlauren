import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * The admin read side of the portfolio module: the queries behind the admin
 * portfolio and portfolio-group pages (two lists and two editors), plus the
 * dashboard count and the upload-handler existence checks. Each returns a
 * module-owned view type — a plain shape mapped from the Prisma rows — so the
 * admin pages never see a Prisma-generated type and the cover-derivation logic
 * lives here rather than being re-spelled on every page.
 *
 * Ordering matches the admin pages exactly: portfolios and groups by sortOrder
 * ascending; a portfolio's photos in an editor by sortOrder ascending; the
 * "ungrouped portfolios" picker by title ascending.
 */
const bySortOrder = { sortOrder: "asc" } as const;

/** A portfolio as the admin portfolios list row renders it. */
export interface AdminPortfolioSummary {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  photoCount: number;
  coverPhotoUrl: string | null;
  group: { title: string } | null;
}

/** A photo as an admin portfolio editor renders it (drag-reorder grid). */
export interface AdminPortfolioPhoto {
  id: string;
  url: string;
  filename: string;
  sortOrder: number;
  portfolioId: string;
}

/** A portfolio as its admin editor renders it. */
export interface AdminPortfolioDetail {
  id: string;
  title: string;
  coverPhotoId: string | null;
  aspectRatio: string;
  photos: AdminPortfolioPhoto[];
}

/** A group as the admin portfolio-groups list row renders it. */
export interface AdminGroupSummary {
  id: string;
  title: string;
  coverImageUrl: string | null;
  portfolioCount: number;
  sortOrder: number;
}

/** A portfolio as it appears in a group editor's grid (in-group or ungrouped). */
export interface GroupPortfolioItem {
  id: string;
  title: string;
  coverPhotoUrl: string | null;
  photoCount: number;
  sortOrder: number;
}

/** A group as its admin editor renders it: header/cover fields plus portfolios. */
export interface AdminGroupDetail {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  aspectRatio: string;
  portfolios: GroupPortfolioItem[];
}

/**
 * All portfolios in sort order, each with its photo count, its cover photo's
 * url (the photo whose id is the stored coverPhotoId, if any), and its group's
 * title (if grouped).
 */
export async function listPortfolios(): Promise<AdminPortfolioSummary[]> {
  const portfolios = await prisma.portfolio.findMany({
    include: {
      _count: { select: { photos: true } },
      photos: { select: { id: true, url: true } },
      group: { select: { id: true, title: true } },
    },
    orderBy: bySortOrder,
  });

  return portfolios.map((portfolio) => {
    const coverPhoto = portfolio.coverPhotoId
      ? portfolio.photos.find((p) => p.id === portfolio.coverPhotoId)
      : null;
    return {
      id: portfolio.id,
      title: portfolio.title,
      slug: portfolio.slug,
      sortOrder: portfolio.sortOrder,
      photoCount: portfolio._count.photos,
      coverPhotoUrl: coverPhoto?.url ?? null,
      group: portfolio.group ? { title: portfolio.group.title } : null,
    };
  });
}

/** A single portfolio by id with its photos in order, or `null` if none exists. */
export async function getPortfolio(
  id: string,
): Promise<AdminPortfolioDetail | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    include: { photos: { orderBy: bySortOrder } },
  });

  if (!portfolio) return null;

  return {
    id: portfolio.id,
    title: portfolio.title,
    coverPhotoId: portfolio.coverPhotoId,
    aspectRatio: portfolio.aspectRatio,
    photos: portfolio.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      filename: photo.filename,
      sortOrder: photo.sortOrder,
      portfolioId: photo.portfolioId,
    })),
  };
}

/**
 * Map a portfolio row (with `coverPhotoId` and a single-photo `photos` array,
 * as the group editor loads them) to a {@link GroupPortfolioItem}. The cover url
 * is that photo's url only when it is the designated cover — preserving the old
 * page's `take: 1` behavior exactly.
 */
function toGroupPortfolioItem(portfolio: {
  id: string;
  title: string;
  sortOrder: number;
  coverPhotoId: string | null;
  _count: { photos: number };
  photos: { id: string; url: string }[];
}): GroupPortfolioItem {
  const coverPhoto = portfolio.coverPhotoId
    ? portfolio.photos.find((p) => p.id === portfolio.coverPhotoId)
    : null;
  return {
    id: portfolio.id,
    title: portfolio.title,
    coverPhotoUrl: coverPhoto?.url ?? null,
    photoCount: portfolio._count.photos,
    sortOrder: portfolio.sortOrder,
  };
}

/** All groups in sort order, with their cover image and portfolio counts. */
export async function listGroups(): Promise<AdminGroupSummary[]> {
  const groups = await prisma.portfolioGroup.findMany({
    include: { _count: { select: { portfolios: true } } },
    orderBy: bySortOrder,
  });

  return groups.map((group) => ({
    id: group.id,
    title: group.title,
    coverImageUrl: group.coverImageUrl,
    portfolioCount: group._count.portfolios,
    sortOrder: group.sortOrder,
  }));
}

/**
 * A single group by id with its portfolios in order, or `null` if none exists.
 * Includes the header/cover fields the editor and cover-uploader need.
 */
export async function getGroupForEdit(
  id: string,
): Promise<AdminGroupDetail | null> {
  const group = await prisma.portfolioGroup.findUnique({
    where: { id },
    include: {
      portfolios: {
        include: {
          _count: { select: { photos: true } },
          photos: { where: {}, take: 1 },
        },
        orderBy: bySortOrder,
      },
    },
  });

  if (!group) return null;

  return {
    id: group.id,
    title: group.title,
    description: group.description,
    coverImageUrl: group.coverImageUrl,
    aspectRatio: group.aspectRatio,
    portfolios: group.portfolios.map(toGroupPortfolioItem),
  };
}

/** The ungrouped portfolios the group editor offers to assign, by title. */
export async function listUngroupedPortfolios(): Promise<GroupPortfolioItem[]> {
  const portfolios = await prisma.portfolio.findMany({
    where: { groupId: null },
    include: {
      _count: { select: { photos: true } },
      photos: { where: {}, take: 1 },
    },
    orderBy: { title: "asc" },
  });

  return portfolios.map(toGroupPortfolioItem);
}

/** How many portfolios exist (dashboard count). */
export function countPortfolios(): Promise<number> {
  return prisma.portfolio.count();
}

/** Whether a portfolio with the given id exists (upload-handler guard). */
export async function portfolioExists(id: string): Promise<boolean> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    select: { id: true },
  });
  return portfolio !== null;
}

/** Whether a group with the given id exists (upload-handler guard). */
export async function groupExists(id: string): Promise<boolean> {
  const group = await prisma.portfolioGroup.findUnique({
    where: { id },
    select: { id: true },
  });
  return group !== null;
}
