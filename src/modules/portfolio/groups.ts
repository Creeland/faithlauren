import "server-only";
import { revalidatePath } from "next/cache";
import { UTApi } from "uploadthing/server";
import { prisma } from "@/lib/prisma";
import type { ReorderItem } from "@/lib/reorder";
import {
  DuplicateSlugError,
  GroupNotEmptyError,
} from "@/modules/shared/errors";
import { slugify } from "./slug";

/**
 * The portfolio-group half of the portfolio module: the admin lifecycle of the
 * groups that portfolios are organized into — create, update, delete, reorder,
 * cover selection, and assigning/removing portfolios to/from a group. Slug
 * generation and the "can't delete a non-empty group" rule live here; cover
 * file cleanup is done through UploadThing; every mutation revalidates the pages
 * it affects. The action layer only parses the form and maps the module's typed
 * failures onto form state.
 *
 * As with the portfolio operations, the module owns revalidation of the PUBLIC
 * pages too, not just the admin views the old actions refreshed: the homepage
 * (its "Selected Work" section lists group covers), the group's public page, and
 * — when a portfolio's group membership changes — that portfolio's nested detail
 * page. The old actions left those stale; that gap closes here.
 */

const utapi = new UTApi();

export interface GroupInput {
  title: string;
  /** Public SEO text; `null` clears it, absent leaves the stored value alone. */
  description?: string | null;
}

export interface GroupCoverInput {
  url: string;
  fileKey: string;
  aspectRatio?: string;
}

/**
 * Create a group from an admin's title. The slug is derived from the title; a
 * collision throws {@link DuplicateSlugError} for the action to map to its
 * form-error message. The new group is appended at the end (one past the current
 * max sortOrder). A brand-new group has no cover and no portfolios, so it is not
 * yet visible on any public page — nothing public to revalidate.
 */
export async function createGroup(input: GroupInput): Promise<{ id: string }> {
  const slug = slugify(input.title);

  const existing = await prisma.portfolioGroup.findUnique({ where: { slug } });
  if (existing) throw new DuplicateSlugError(slug);

  const maxSort = await prisma.portfolioGroup.aggregate({
    _max: { sortOrder: true },
  });

  const group = await prisma.portfolioGroup.create({
    data: {
      title: input.title,
      slug,
      description: input.description,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  return { id: group.id };
}

/**
 * Update a group's title and description. The slug is intentionally left
 * unchanged, so the client-facing URL is stable across renames. Revalidates the
 * admin detail page (as the old action did) plus the public pages that surface
 * the group's title/description: the homepage and the group's own page.
 */
export async function updateGroup(
  id: string,
  input: GroupInput,
): Promise<void> {
  const group = await prisma.portfolioGroup.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
    },
    select: { slug: true },
  });

  revalidatePath(`/admin/portfolio-groups/${id}`);
  revalidatePath("/");
  revalidatePath(`/portfolio/${group.slug}`);
}

/**
 * Delete an empty group. A group that still contains portfolios cannot be
 * deleted — that would orphan them — so this throws {@link GroupNotEmptyError}
 * for the action to map to its form message. Otherwise the group's cover file
 * (if any) is removed from UploadThing before the row is deleted, and the
 * homepage and the now-gone group page are revalidated.
 */
export async function deleteGroup(id: string): Promise<void> {
  const group = await prisma.portfolioGroup.findUnique({
    where: { id },
    select: {
      slug: true,
      coverImageFileKey: true,
      _count: { select: { portfolios: true } },
    },
  });

  if (group && group._count.portfolios > 0) {
    throw new GroupNotEmptyError(id);
  }

  if (group?.coverImageFileKey) {
    await utapi.deleteFiles([group.coverImageFileKey]);
  }

  await prisma.portfolioGroup.delete({ where: { id } });

  revalidatePath("/");
  if (group?.slug) {
    revalidatePath(`/portfolio/${group.slug}`);
  }
}

/**
 * Persist a new sort order for a set of groups, in one transaction (the old
 * action fired the updates in parallel; running them atomically matches the
 * portfolio reorder and can't leave a half-applied order). Group order drives
 * the homepage "Selected Work" layout, so the homepage is revalidated alongside
 * the admin list.
 */
export async function reorderGroups(order: ReorderItem[]): Promise<void> {
  await prisma.$transaction(
    order.map((item) =>
      prisma.portfolioGroup.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );

  revalidatePath("/admin/portfolio-groups");
  revalidatePath("/");
}

/**
 * Set (or replace) a group's cover image. When the new file key differs from the
 * stored one, the old file is removed from UploadThing first (matching the old
 * action exactly — including the ratio-only update path, which submits an empty
 * file key and thus clears the stored key while dropping the previous file). The
 * cover shows on the homepage and the group page, so both are revalidated
 * alongside the admin detail page.
 */
export async function setGroupCover(
  id: string,
  input: GroupCoverInput,
): Promise<void> {
  const group = await prisma.portfolioGroup.findUnique({
    where: { id },
    select: { slug: true, coverImageFileKey: true },
  });

  // Delete old cover image if replacing with a different file.
  if (group?.coverImageFileKey && group.coverImageFileKey !== input.fileKey) {
    await utapi.deleteFiles([group.coverImageFileKey]);
  }

  await prisma.portfolioGroup.update({
    where: { id },
    data: {
      coverImageUrl: input.url,
      coverImageFileKey: input.fileKey,
      ...(input.aspectRatio && { aspectRatio: input.aspectRatio }),
    },
  });

  revalidatePath(`/admin/portfolio-groups/${id}`);
  revalidatePath("/");
  if (group?.slug) {
    revalidatePath(`/portfolio/${group.slug}`);
  }
}

/**
 * Assign a portfolio to a group (a portfolio belongs to at most one group, so
 * this simply sets the new groupId, moving it out of any previous group).
 * Revalidates the admin portfolios list and the group's admin page (as before),
 * plus the public pages the change surfaces on: the homepage, the group's page
 * (which now lists this portfolio), and the portfolio's now-nested detail page.
 */
export async function assignPortfolioToGroup(
  portfolioId: string,
  groupId: string,
): Promise<void> {
  const portfolio = await prisma.portfolio.update({
    where: { id: portfolioId },
    data: { groupId },
    select: { slug: true, group: { select: { slug: true } } },
  });

  revalidatePath("/admin/portfolios");
  revalidatePath(`/admin/portfolio-groups/${groupId}`);
  revalidatePath("/");
  if (portfolio.group) {
    revalidatePath(`/portfolio/${portfolio.group.slug}`);
    revalidatePath(`/portfolio/${portfolio.group.slug}/${portfolio.slug}`);
  }
}

/**
 * Remove a portfolio from its group. The old membership is read first so the
 * former group's admin page can be revalidated (as before); the homepage and the
 * former group's public page are revalidated too, since the portfolio no longer
 * appears there.
 */
export async function removePortfolioFromGroup(
  portfolioId: string,
): Promise<void> {
  const before = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: { group: { select: { id: true, slug: true } } },
  });

  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: { groupId: null },
  });

  revalidatePath("/admin/portfolios");
  revalidatePath("/");
  if (before?.group) {
    revalidatePath(`/admin/portfolio-groups/${before.group.id}`);
    revalidatePath(`/portfolio/${before.group.slug}`);
  }
}
