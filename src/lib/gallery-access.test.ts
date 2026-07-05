import { describe, it, expect, beforeEach } from "vitest";
import {
  decryptGalleryPassword,
  encryptGalleryPassword,
  galleryAccessCookieName,
  galleryAccessToken,
  isEncryptedGalleryPassword,
  verifyGalleryAccessToken,
} from "./gallery-access";

const gallery = {
  id: "gal_123",
  slug: "smith-wedding",
  password: "a1b2c3d4",
};

describe("gallery access tokens", () => {
  beforeEach(() => {
    process.env.GALLERY_ACCESS_SECRET = "test-secret";
  });

  it("builds the cookie name from the slug", () => {
    expect(galleryAccessCookieName("smith-wedding")).toBe(
      "gallery-smith-wedding-access",
    );
  });

  it("accepts the token it issued for the same gallery", () => {
    const token = galleryAccessToken(gallery);
    expect(verifyGalleryAccessToken(token, gallery)).toBe(true);
  });

  it("rejects the legacy forgeable value", () => {
    expect(verifyGalleryAccessToken("granted", gallery)).toBe(false);
  });

  it("rejects a missing token", () => {
    expect(verifyGalleryAccessToken(undefined, gallery)).toBe(false);
    expect(verifyGalleryAccessToken("", gallery)).toBe(false);
  });

  it("rejects a token issued for a different gallery", () => {
    const otherToken = galleryAccessToken({
      id: "gal_456",
      slug: "jones-wedding",
      password: "deadbeef",
    });
    expect(verifyGalleryAccessToken(otherToken, gallery)).toBe(false);
  });

  it("rejects tokens issued before a password regeneration", () => {
    const oldToken = galleryAccessToken(gallery);
    const rotated = { ...gallery, password: "e5f6a7b8" };
    expect(verifyGalleryAccessToken(oldToken, rotated)).toBe(false);
    expect(verifyGalleryAccessToken(galleryAccessToken(rotated), rotated)).toBe(
      true,
    );
  });

  it("rejects a tampered token", () => {
    const token = galleryAccessToken(gallery);
    const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(verifyGalleryAccessToken(tampered, gallery)).toBe(false);
  });

  it("verifies with a different secret only if it matches", () => {
    const token = galleryAccessToken(gallery);
    process.env.GALLERY_ACCESS_SECRET = "another-secret";
    expect(verifyGalleryAccessToken(token, gallery)).toBe(false);
  });

  it("throws when no signing secret is configured", () => {
    delete process.env.GALLERY_ACCESS_SECRET;
    delete process.env.AUTH_SECRET;
    expect(() => galleryAccessToken(gallery)).toThrow(
      /GALLERY_ACCESS_SECRET or AUTH_SECRET/,
    );
  });

  it("issues the same token for a legacy plaintext row and its encrypted form", () => {
    const encrypted = {
      ...gallery,
      password: encryptGalleryPassword(gallery.password),
    };
    expect(galleryAccessToken(encrypted)).toBe(galleryAccessToken(gallery));
    expect(
      verifyGalleryAccessToken(galleryAccessToken(gallery), encrypted),
    ).toBe(true);
  });
});

describe("gallery password encryption at rest", () => {
  beforeEach(() => {
    process.env.GALLERY_ACCESS_SECRET = "test-secret";
  });

  it("round-trips a password through encrypt/decrypt", () => {
    const stored = encryptGalleryPassword("a1b2c3d4e5f6a7b8");
    expect(stored).toMatch(/^enc:v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(decryptGalleryPassword(stored)).toBe("a1b2c3d4e5f6a7b8");
  });

  it("produces a fresh ciphertext per call (random IV)", () => {
    const a = encryptGalleryPassword("a1b2c3d4");
    const b = encryptGalleryPassword("a1b2c3d4");
    expect(a).not.toBe(b);
    expect(decryptGalleryPassword(a)).toBe(decryptGalleryPassword(b));
  });

  it("passes legacy plaintext values through unchanged", () => {
    expect(isEncryptedGalleryPassword("a1b2c3d4")).toBe(false);
    expect(decryptGalleryPassword("a1b2c3d4")).toBe("a1b2c3d4");
  });

  it("detects encrypted values", () => {
    expect(isEncryptedGalleryPassword(encryptGalleryPassword("x"))).toBe(true);
  });

  it("throws on a tampered ciphertext", () => {
    const stored = encryptGalleryPassword("a1b2c3d4");
    const tampered = stored.slice(0, -1) + (stored.endsWith("0") ? "1" : "0");
    expect(() => decryptGalleryPassword(tampered)).toThrow();
  });

  it("throws on a malformed encrypted value", () => {
    expect(() => decryptGalleryPassword("enc:v1:zz")).toThrow(/Malformed/);
    expect(() => decryptGalleryPassword("enc:v1:abcd:ef01")).toThrow(
      /Malformed/,
    );
  });

  it("cannot decrypt with a different secret", () => {
    const stored = encryptGalleryPassword("a1b2c3d4");
    process.env.GALLERY_ACCESS_SECRET = "another-secret";
    expect(() => decryptGalleryPassword(stored)).toThrow();
  });
});
