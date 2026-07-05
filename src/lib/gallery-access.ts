import crypto from "crypto";

type GalleryIdentity = {
  id: string;
  slug: string;
  // The stored password column: either an enc:v1: ciphertext or a
  // legacy plaintext value.
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

// Gallery passwords are stored encrypted (not hashed) because the admin
// UI must display the shareable password back to the photographer. The
// key is derived from the same secret that signs access tokens; the HKDF
// info string domain-separates the two uses.
const ENCRYPTED_PASSWORD_PREFIX = "enc:v1:";

function passwordEncryptionKey() {
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      accessSecret(),
      "",
      "gallery-password-encryption-v1",
      32,
    ),
  );
}

export function isEncryptedGalleryPassword(stored: string) {
  return stored.startsWith(ENCRYPTED_PASSWORD_PREFIX);
}

export function encryptGalleryPassword(plaintext: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    passwordEncryptionKey(),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return (
    ENCRYPTED_PASSWORD_PREFIX +
    [iv, tag, ciphertext].map((b) => b.toString("hex")).join(":")
  );
}

// Returns the shareable plaintext password for a stored column value.
// Legacy rows (written before encryption at rest) hold the plaintext
// directly and pass through unchanged; generated passwords are pure hex
// so they can never collide with the enc:v1: prefix.
export function decryptGalleryPassword(stored: string) {
  if (!isEncryptedGalleryPassword(stored)) return stored;
  const parts = stored.slice(ENCRYPTED_PASSWORD_PREFIX.length).split(":");
  if (parts.length !== 3 || parts.some((p) => !/^[0-9a-f]+$/.test(p))) {
    throw new Error("Malformed encrypted gallery password");
  }
  const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, "hex"));
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    passwordEncryptionKey(),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

// The plaintext gallery password is part of the HMAC input so regenerating
// the password revokes every previously issued access cookie. Using the
// decrypted value keeps tokens stable when a legacy plaintext row is
// re-encrypted in place (same password, new stored form).
export function galleryAccessToken(gallery: GalleryIdentity) {
  return crypto
    .createHmac("sha256", accessSecret())
    .update(
      `${gallery.id}:${gallery.slug}:${decryptGalleryPassword(gallery.password)}`,
    )
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
