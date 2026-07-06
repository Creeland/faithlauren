import { describe, it, expect } from "vitest";
import { isAllowedPhotoUrl } from "./photo-url";

describe("isAllowedPhotoUrl", () => {
  it("allows the UploadThing utfs.io host", () => {
    expect(isAllowedPhotoUrl("https://utfs.io/f/abc123")).toBe(true);
  });

  it("allows *.ufs.sh wildcard subdomains", () => {
    expect(isAllowedPhotoUrl("https://abc.ufs.sh/f/xyz")).toBe(true);
  });

  it("allows the unsplash image host", () => {
    expect(isAllowedPhotoUrl("https://images.unsplash.com/photo-1")).toBe(true);
  });

  it("rejects a non-allowlisted host", () => {
    expect(isAllowedPhotoUrl("https://evil.example.com/x.jpg")).toBe(false);
  });

  it("rejects internal metadata endpoints", () => {
    expect(isAllowedPhotoUrl("http://169.254.169.254/latest/meta-data")).toBe(
      false,
    );
  });

  it("rejects localhost", () => {
    expect(isAllowedPhotoUrl("https://localhost:8080/x")).toBe(false);
    expect(isAllowedPhotoUrl("https://127.0.0.1/x")).toBe(false);
  });

  it("rejects non-https protocols on an allowed host", () => {
    expect(isAllowedPhotoUrl("http://utfs.io/f/abc")).toBe(false);
  });

  it("rejects the bare apex of a wildcard pattern", () => {
    expect(isAllowedPhotoUrl("https://ufs.sh/f/abc")).toBe(false);
  });

  it("rejects multi-level subdomains against a single-level wildcard", () => {
    expect(isAllowedPhotoUrl("https://a.b.ufs.sh/f/abc")).toBe(false);
  });

  it("rejects a host that merely ends with an allowed host as a substring", () => {
    expect(isAllowedPhotoUrl("https://notutfs.io/f/abc")).toBe(false);
    expect(isAllowedPhotoUrl("https://evilutfs.io/f/abc")).toBe(false);
  });

  it("rejects an allowed host used as a subdomain of an attacker domain", () => {
    expect(isAllowedPhotoUrl("https://utfs.io.evil.com/f/abc")).toBe(false);
  });

  it("is case-insensitive on the host", () => {
    expect(isAllowedPhotoUrl("https://UTFS.io/f/abc")).toBe(true);
  });

  it("rejects malformed URLs", () => {
    expect(isAllowedPhotoUrl("not a url")).toBe(false);
    expect(isAllowedPhotoUrl("")).toBe(false);
  });
});
