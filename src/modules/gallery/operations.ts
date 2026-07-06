import "server-only";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { encryptGalleryPassword } from "@/lib/gallery-access";
import { DuplicateSlugError } from "@/modules/shared/errors";
import { deleteAllPhotos } from "@/modules/photos";
import { slugify } from "./slug";

/**
 * The gallery module: one interface over the admin gallery lifecycle — create,
 * update, delete, and password regeneration. Slug generation and password
 * generation live here; the action layer only parses the form and maps the
 * module's typed failures onto form state. Each mutation revalidates the paths
 * it affects, so callers never have to remember to.
 */

/** A fresh, shareable client password: 16 hex chars, stored encrypted at rest. */
function generatePassword(): string {
  return crypto.randomBytes(8).toString("hex");
}

export interface GalleryInput {
  title: string;
  description?: string | null;
}

/**
 * Create a gallery from an admin's title/description. The slug is derived from
 * the title; a collision throws {@link DuplicateSlugError} for the action to map
 * to its form-error message. A unique client password is generated and stored
 * encrypted. Revalidates the admin list so the new row appears.
 */
export async function createGallery(
  input: GalleryInput,
): Promise<{ id: string }> {
  const slug = slugify(input.title);

  const existing = await prisma.gallery.findUnique({ where: { slug } });
  if (existing) throw new DuplicateSlugError(slug);

  const gallery = await prisma.gallery.create({
    data: {
      title: input.title,
      slug,
      description: input.description || null,
      password: encryptGalleryPassword(generatePassword()),
    },
    select: { id: true },
  });

  revalidatePath("/admin/galleries");
  return { id: gallery.id };
}

/**
 * Update a gallery's title and description. The slug is intentionally left
 * unchanged (as the old action did), so the client-facing URL is stable across
 * renames. Revalidates the admin detail page and — closing the same
 * stale-public-page gap the photos module addressed — the public gallery page,
 * which surfaces the title/description.
 */
export async function updateGallery(
  id: string,
  input: GalleryInput,
): Promise<void> {
  const gallery = await prisma.gallery.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description || null,
    },
    select: { slug: true },
  });

  revalidatePath(`/admin/galleries/${id}`);
  revalidatePath(`/gallery/${gallery.slug}`);
}

/**
 * Delete a gallery and everything under it. Stored-file cleanup and photo-row
 * removal are delegated to the photos module ({@link deleteAllPhotos}); the
 * gallery row itself is then removed. Revalidates the admin list. (The DB-level
 * cascade would drop the photo rows anyway, but the UploadThing files would be
 * orphaned — the module owns that cleanup.)
 */
export async function deleteGallery(id: string): Promise<void> {
  await deleteAllPhotos({ gallery: id });
  await prisma.gallery.delete({ where: { id } });
  revalidatePath("/admin/galleries");
}

/**
 * Replace a gallery's client password with a freshly generated one, effective
 * immediately: the next password check runs against the new value, and every
 * previously issued access cookie is invalidated (the token is derived from the
 * password). Revalidates the admin detail page and the public gallery page.
 */
export async function regeneratePassword(id: string): Promise<void> {
  const gallery = await prisma.gallery.update({
    where: { id },
    data: { password: encryptGalleryPassword(generatePassword()) },
    select: { slug: true },
  });

  revalidatePath(`/admin/galleries/${id}`);
  revalidatePath(`/gallery/${gallery.slug}`);
}
