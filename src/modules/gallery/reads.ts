import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptGalleryPassword } from "@/lib/gallery-access";

/**
 * The admin read side of the gallery module: the queries behind the two admin
 * gallery pages (the list and a single gallery's editor) plus the dashboard
 * counts and the upload-handler existence check. Each returns a module-owned
 * view type — a plain shape mapped from the Prisma rows — so the pages never see
 * a Prisma-generated `Gallery`/`Photo` type.
 *
 * Unlike the public {@link ./access} views, the admin views intentionally carry
 * the gallery's plaintext password: the admin UI shows it back to the
 * photographer. The stored column is encrypted, so the decryption happens here
 * (once, inside the module) rather than at the call site — no `@/lib/gallery-access`
 * import leaks onto a page.
 *
 * Photos are always listed in display order; that ordering invariant is shared
 * with {@link ./access} and stated the same way.
 */
const bySortOrder = { sortOrder: "asc" } as const;

/** A photo as an admin gallery editor renders it (drag-reorder grid). */
export interface AdminPhoto {
  id: string;
  url: string;
  filename: string;
  caption: string | null;
  sortOrder: number;
  galleryId: string;
}

/** A gallery as the admin list row renders it. `password` is the plaintext. */
export interface AdminGallerySummary {
  id: string;
  title: string;
  slug: string;
  photoCount: number;
  password: string;
}

/** A gallery as its admin editor renders it. `password` is the plaintext. */
export interface AdminGalleryDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  password: string;
  photos: AdminPhoto[];
}

/** All galleries newest-first, with their photo counts and shareable passwords. */
export async function listGalleries(): Promise<AdminGallerySummary[]> {
  const galleries = await prisma.gallery.findMany({
    include: { _count: { select: { photos: true } } },
    orderBy: { createdAt: "desc" },
  });

  return galleries.map((gallery) => ({
    id: gallery.id,
    title: gallery.title,
    slug: gallery.slug,
    photoCount: gallery._count.photos,
    password: decryptGalleryPassword(gallery.password),
  }));
}

/** A single gallery by id with its photos in order, or `null` if none exists. */
export async function getGallery(id: string): Promise<AdminGalleryDetail | null> {
  const gallery = await prisma.gallery.findUnique({
    where: { id },
    include: { photos: { orderBy: bySortOrder } },
  });

  if (!gallery) return null;

  return {
    id: gallery.id,
    title: gallery.title,
    slug: gallery.slug,
    description: gallery.description,
    password: decryptGalleryPassword(gallery.password),
    photos: gallery.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      filename: photo.filename,
      caption: photo.caption,
      sortOrder: photo.sortOrder,
      galleryId: photo.galleryId,
    })),
  };
}

/** How many galleries exist (dashboard count). */
export function countGalleries(): Promise<number> {
  return prisma.gallery.count();
}

/** How many gallery photos exist across all galleries (dashboard count). */
export function countGalleryPhotos(): Promise<number> {
  return prisma.photo.count();
}

/** Whether a gallery with the given id exists (upload-handler guard). */
export async function galleryExists(id: string): Promise<boolean> {
  const gallery = await prisma.gallery.findUnique({
    where: { id },
    select: { id: true },
  });
  return gallery !== null;
}
