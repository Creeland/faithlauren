import "server-only";
import { prisma } from "@/lib/prisma";
import type { ReorderItem } from "@/lib/reorder";

/**
 * A Container is whatever a photo belongs to. The two photo tables (`Photo`
 * under a gallery, `PortfolioPhoto` under a portfolio) are shape-identical by
 * copy-paste history; the photos module hides that split behind this single
 * discriminated type and an internal delegate lookup, so callers never name a
 * table. A future merge of the two tables changes only the delegate.
 */
export type Container = { gallery: string } | { portfolio: string };

/**
 * The table-specific half of every photo operation. Everything shared —
 * deleting the stored file, revalidating paths — lives in the operations layer;
 * the delegate is only the raw per-table data access plus the small
 * differences (a portfolio owns a cover photo; a gallery does not).
 */
export interface PhotoDelegate {
  /** Look up a single photo's stored-file key, or null if it does not exist. */
  findPhoto(photoId: string): Promise<{ fileKey: string | null } | null>;
  /** Remove one photo row, clearing the container's cover if it pointed here. */
  removePhoto(photoId: string): Promise<void>;
  /** Stored-file keys of every photo in the container (nulls dropped). */
  fileKeys(): Promise<string[]>;
  /** Remove every photo row in the container, clearing the cover if any. */
  removeAll(): Promise<void>;
  /** Persist a new sort order for the given photos, in one transaction. */
  reorder(order: ReorderItem[]): Promise<void>;
  /** Count the photos in the container. */
  count(): Promise<number>;
}

function galleryDelegate(galleryId: string): PhotoDelegate {
  return {
    findPhoto: (photoId) =>
      prisma.photo.findUnique({
        where: { id: photoId },
        select: { fileKey: true },
      }),
    removePhoto: async (photoId) => {
      await prisma.photo.delete({ where: { id: photoId } });
    },
    fileKeys: async () => {
      const photos = await prisma.photo.findMany({
        where: { galleryId },
        select: { fileKey: true },
      });
      return photos.map((p) => p.fileKey).filter(Boolean) as string[];
    },
    removeAll: async () => {
      await prisma.photo.deleteMany({ where: { galleryId } });
    },
    reorder: async (order) => {
      await prisma.$transaction(
        order.map((item) =>
          prisma.photo.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          }),
        ),
      );
    },
    count: () => prisma.photo.count({ where: { galleryId } }),
  };
}

function portfolioDelegate(portfolioId: string): PhotoDelegate {
  return {
    findPhoto: (photoId) =>
      prisma.portfolioPhoto.findUnique({
        where: { id: photoId },
        select: { fileKey: true },
      }),
    removePhoto: async (photoId) => {
      // Clear the cover first if this photo is it, matching the old action's
      // find-then-null-then-delete order. `updateMany` is a no-op when the
      // photo is not the cover, so no separate lookup is needed.
      await prisma.portfolio.updateMany({
        where: { id: portfolioId, coverPhotoId: photoId },
        data: { coverPhotoId: null },
      });
      await prisma.portfolioPhoto.delete({ where: { id: photoId } });
    },
    fileKeys: async () => {
      const photos = await prisma.portfolioPhoto.findMany({
        where: { portfolioId },
        select: { fileKey: true },
      });
      return photos.map((p) => p.fileKey).filter(Boolean) as string[];
    },
    removeAll: async () => {
      await prisma.portfolioPhoto.deleteMany({ where: { portfolioId } });
      // Deleting every photo necessarily removes the cover; clear it.
      await prisma.portfolio.update({
        where: { id: portfolioId },
        data: { coverPhotoId: null },
      });
    },
    reorder: async (order) => {
      await prisma.$transaction(
        order.map((item) =>
          prisma.portfolioPhoto.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          }),
        ),
      );
    },
    count: () => prisma.portfolioPhoto.count({ where: { portfolioId } }),
  };
}

/** Pick the table-specific delegate for a container. */
export function resolveDelegate(container: Container): PhotoDelegate {
  return "gallery" in container
    ? galleryDelegate(container.gallery)
    : portfolioDelegate(container.portfolio);
}
