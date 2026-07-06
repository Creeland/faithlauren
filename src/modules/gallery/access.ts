import "server-only";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  decryptGalleryPassword,
  encryptGalleryPassword,
  galleryAccessToken,
  isEncryptedGalleryPassword,
  timingSafeEqualStrings,
  verifyGalleryAccessToken,
} from "@/lib/gallery-access";
import { InvalidAlbumPasswordError } from "@/modules/shared/errors";

/**
 * The gallery client-access contract, owned in one place. The cookie name,
 * value, and 30-day TTL are defined here and nowhere else; the public page,
 * download route, and password-entry action all go through this module rather
 * than re-deriving the cookie themselves.
 */

// The unlock persists for 30 days.
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

// Each album has its own access cookie, keyed by slug.
function accessCookieName(slug: string): string {
  return `gallery-${slug}-access`;
}

/** A photo as the public gallery renders it — no storage/admin fields. */
export interface PublicPhoto {
  id: string;
  url: string;
  filename: string;
  caption: string | null;
  width: number | null;
  height: number | null;
}

/**
 * The gallery as the public page and download route see it. The password column
 * is structurally absent from this type, so a secret cannot leak into a
 * server-component payload. Photos are returned in display order.
 */
export interface PublicGalleryView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  photos: PublicPhoto[];
}

/** An unlock grant from {@link verifyPassword}: the derived token, no password. */
export interface AccessGrant {
  slug: string;
  token: string;
}

/**
 * Load the public view of a gallery by slug, or `null` if none exists. The
 * select is narrowed to the public fields, so the password never leaves the
 * module — callers get a {@link PublicGalleryView} with no way to reach it.
 */
export async function getPublicGallery(
  slug: string,
): Promise<PublicGalleryView | null> {
  return prisma.gallery.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      photos: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          url: true,
          filename: true,
          caption: true,
          width: true,
          height: true,
        },
      },
    },
  });
}

/**
 * Whether the current request already holds a valid access cookie for the
 * gallery. Reads the cookie and verifies it against the gallery's stored
 * password (fetched here, never exposed). A regenerated password invalidates
 * every previously issued cookie, because the token derives from the password.
 */
export async function hasAccess(slug: string): Promise<boolean> {
  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    select: { id: true, slug: true, password: true },
  });
  if (!gallery) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(accessCookieName(slug))?.value;
  return verifyGalleryAccessToken(token, gallery);
}

/**
 * Verify a submitted password against the gallery's stored (encrypted or legacy
 * plaintext) value. On success returns an {@link AccessGrant} carrying the
 * derived access token — no password — for {@link grantAccess}. On any failure,
 * unknown slug and wrong password alike, throws {@link InvalidAlbumPasswordError}
 * so the caller cannot distinguish the two. Legacy plaintext rows are
 * opportunistically re-encrypted in place; the token derives from the plaintext,
 * so this does not revoke existing cookies.
 */
export async function verifyPassword(
  slug: string,
  password: string,
): Promise<AccessGrant> {
  const gallery = await prisma.gallery.findUnique({ where: { slug } });

  if (
    !gallery ||
    !timingSafeEqualStrings(password, decryptGalleryPassword(gallery.password))
  ) {
    throw new InvalidAlbumPasswordError(slug);
  }

  if (!isEncryptedGalleryPassword(gallery.password)) {
    await prisma.gallery.update({
      where: { id: gallery.id },
      data: { password: encryptGalleryPassword(password) },
    });
  }

  return { slug, token: galleryAccessToken(gallery) };
}

/**
 * Persist an unlock: write the album-access cookie from a {@link verifyPassword}
 * grant with the 30-day TTL owned here, then refresh the gated public page so it
 * re-renders unlocked.
 */
export async function grantAccess(grant: AccessGrant): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(accessCookieName(grant.slug), grant.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  revalidatePath(`/gallery/${grant.slug}`);
}
