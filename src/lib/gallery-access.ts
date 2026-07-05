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

// Constant-time comparison of secrets of possibly different lengths:
// hashing both sides first gives timingSafeEqual equal-length inputs
// without an early-exit length check.
export function timingSafeEqualStrings(a: string, b: string) {
  const digestA = crypto.createHash("sha256").update(a).digest();
  const digestB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export function verifyGalleryAccessToken(
  token: string | undefined,
  gallery: GalleryIdentity,
) {
  if (!token) return false;
  return timingSafeEqualStrings(token, galleryAccessToken(gallery));
}
