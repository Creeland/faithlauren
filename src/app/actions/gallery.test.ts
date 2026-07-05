import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockCookieSet, requestHeaders } = vi.hoisted(() => {
  const requestHeaders = new Map<string, string>();
  return {
    requestHeaders,
    mockCookieSet: vi.fn(),
    mockPrisma: {
      gallery: {
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/dal", () => ({ verifyAdmin: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: mockCookieSet })),
  headers: vi.fn(async () => ({
    get: (name: string) => requestHeaders.get(name) ?? null,
  })),
}));
vi.mock("uploadthing/server", () => ({
  UTApi: vi.fn().mockImplementation(() => ({ deleteFiles: vi.fn() })),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { verifyAlbumPassword } from "./gallery";
import { clearRateLimits } from "@/lib/rate-limit";

const gallery = {
  id: "gal_123",
  slug: "smith-wedding",
  password: "a1b2c3d4e5f6a7b8",
};

function attempt(password: string, slug = gallery.slug) {
  const fd = new FormData();
  fd.set("slug", slug);
  fd.set("password", password);
  return verifyAlbumPassword(undefined, fd);
}

beforeEach(() => {
  vi.clearAllMocks();
  clearRateLimits();
  requestHeaders.clear();
  requestHeaders.set("x-forwarded-for", "203.0.113.7");
  process.env.GALLERY_ACCESS_SECRET = "test-secret";
  mockPrisma.gallery.findUnique.mockResolvedValue(gallery);
});

describe("verifyAlbumPassword", () => {
  it("sets the access cookie for the correct password", async () => {
    const result = await attempt(gallery.password);

    expect(result).toBeUndefined();
    expect(mockCookieSet).toHaveBeenCalledWith(
      "gallery-smith-wedding-access",
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("rejects a wrong password without setting a cookie", async () => {
    const result = await attempt("wrong-password");

    expect(result?.error).toMatch(/didn’t work/);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("rejects an unknown slug with the same error", async () => {
    mockPrisma.gallery.findUnique.mockResolvedValue(null);

    const result = await attempt("whatever", "no-such-gallery");

    expect(result?.error).toMatch(/didn’t work/);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("rejects a missing password without touching the database", async () => {
    const fd = new FormData();
    fd.set("slug", gallery.slug);

    const result = await verifyAlbumPassword(undefined, fd);

    expect(result?.error).toBeTruthy();
    expect(mockPrisma.gallery.findUnique).not.toHaveBeenCalled();
  });

  it("throttles after 5 attempts from the same IP, before the DB lookup", async () => {
    for (let i = 0; i < 5; i++) {
      await attempt("wrong-password");
    }
    mockPrisma.gallery.findUnique.mockClear();

    const result = await attempt(gallery.password);

    expect(result?.error).toMatch(/Too many password attempts/);
    expect(mockPrisma.gallery.findUnique).not.toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("throttles per gallery across different IPs after 20 attempts", async () => {
    for (let i = 0; i < 20; i++) {
      requestHeaders.set("x-forwarded-for", `198.51.100.${i}`);
      await attempt("wrong-password");
    }

    requestHeaders.set("x-forwarded-for", "198.51.100.200");
    const result = await attempt(gallery.password);

    expect(result?.error).toMatch(/Too many password attempts/);
  });

  it("does not throttle a different gallery for the same IP", async () => {
    for (let i = 0; i < 5; i++) {
      await attempt("wrong-password");
    }

    const result = await attempt("wrong-password", "jones-wedding");

    expect(result?.error).toMatch(/didn’t work/);
  });
});
