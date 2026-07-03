import { describe, it, expect, vi, beforeEach } from "vitest";

const { cookieJar } = vi.hoisted(() => ({
  cookieJar: new Map<
    string,
    { value: string; options: Record<string, unknown> }
  >(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieJar.set(name, { value, options });
    },
    get: (name: string) => {
      const entry = cookieJar.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
  }),
}));

import { grantGalleryAccess, hasGalleryAccess } from "./gallery-access";

describe("gallery access", () => {
  beforeEach(() => {
    cookieJar.clear();
  });

  it("is denied by default", async () => {
    expect(await hasGalleryAccess("emma-sam")).toBe(false);
  });

  it("grant then check round-trips", async () => {
    await grantGalleryAccess("emma-sam");
    expect(await hasGalleryAccess("emma-sam")).toBe(true);
  });

  it("access is scoped per gallery slug", async () => {
    await grantGalleryAccess("emma-sam");
    expect(await hasGalleryAccess("another-gallery")).toBe(false);
  });

  it("sets a long-lived httpOnly cookie", async () => {
    await grantGalleryAccess("emma-sam");
    const entry = [...cookieJar.values()][0];
    expect(entry.options.httpOnly).toBe(true);
    expect(entry.options.maxAge).toBe(60 * 60 * 24 * 30);
  });
});
