import crypto from "crypto";

type GalleryIdentity = {
  id: string;
  slug: string;
  password: string;
};

function accessSecret() {
  const secret = process.env.GALLERY_ACCESS_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "GALLERY_ACCESS_SECRET or AUTH_SECRET must be set to sign gallery access tokens",
    );
  }
  return secret;
}

export function galleryAccessCookieName(slug: string) {
  return `gallery-${slug}-access`;
}

// The gallery password is part of the HMAC input so regenerating the
// password revokes every previously issued access cookie.
export function galleryAccessToken(gallery: GalleryIdentity) {
  return crypto
    .createHmac("sha256", accessSecret())
    .update(`${gallery.id}:${gallery.slug}:${gallery.password}`)
    .digest("hex");
}

export function verifyGalleryAccessToken(
  token: string | undefined,
  gallery: GalleryIdentity,
) {
  if (!token) return false;
  const expected = Buffer.from(galleryAccessToken(gallery));
  const provided = Buffer.from(token);
  return (
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected)
  );
}
