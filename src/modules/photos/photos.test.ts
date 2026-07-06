import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import type { PrismaClient } from "@prisma/client";

// The module reads its Prisma client from "@/lib/prisma" at call time. We hand
// it a REAL client bound to a throwaway SQLite database (assigned below via the
// holder), so these are true module-interface tests with zero Prisma mocks.
// Only genuine externals are mocked: UploadThing, and Next's cache.
const { prismaHolder, deleteFilesMock, revalidatePathMock } = vi.hoisted(
  () => ({
    prismaHolder: {} as { prisma?: PrismaClient },
    deleteFilesMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }),
);

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaHolder.prisma;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("uploadthing/server", () => ({
  UTApi: vi.fn(() => ({ deleteFiles: deleteFilesMock })),
}));

import { createTestDb } from "@/test/sqlite-harness";
import * as photos from "@/modules/photos";

const db = createTestDb();
prismaHolder.prisma = db.prisma;
const prisma = db.prisma;

beforeAll(async () => {
  await db.push();
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  vi.clearAllMocks();
  // Children first for the foreign keys.
  await prisma.photo.deleteMany();
  await prisma.portfolioPhoto.deleteMany();
  await prisma.gallery.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.portfolioGroup.deleteMany();
});

async function seedGallery(slug = "spring") {
  return prisma.gallery.create({
    data: { title: "Spring", slug, password: "pw", updatedAt: new Date() },
  });
}

async function seedGalleryPhoto(
  galleryId: string,
  overrides: Partial<{ fileKey: string | null; sortOrder: number }> = {},
) {
  return prisma.photo.create({
    data: {
      url: "https://utfs.io/f/abc",
      filename: "a.jpg",
      galleryId,
      fileKey: "fileKey" in overrides ? overrides.fileKey : "key-a",
      sortOrder: overrides.sortOrder ?? 0,
    },
  });
}

async function seedPortfolio(slug = "weddings", groupId?: string) {
  return prisma.portfolio.create({
    data: { title: "Weddings", slug, groupId, updatedAt: new Date() },
  });
}

async function seedPortfolioPhoto(
  portfolioId: string,
  overrides: Partial<{ fileKey: string | null; sortOrder: number }> = {},
) {
  return prisma.portfolioPhoto.create({
    data: {
      url: "https://utfs.io/f/xyz",
      filename: "x.jpg",
      portfolioId,
      fileKey: "fileKey" in overrides ? overrides.fileKey : "key-x",
      sortOrder: overrides.sortOrder ?? 0,
    },
  });
}

describe("photos.deletePhoto — gallery container", () => {
  it("removes the row and its stored file, then revalidates", async () => {
    const gallery = await seedGallery("spring");
    const photo = await seedGalleryPhoto(gallery.id, { fileKey: "key-1" });

    await photos.deletePhoto({ gallery: gallery.id }, photo.id);

    expect(
      await prisma.photo.findUnique({ where: { id: photo.id } }),
    ).toBeNull();
    expect(deleteFilesMock).toHaveBeenCalledWith("key-1");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/galleries/${gallery.id}`,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery/spring");
  });

  it("skips file deletion when the photo has no fileKey", async () => {
    const gallery = await seedGallery();
    const photo = await seedGalleryPhoto(gallery.id, { fileKey: null });

    await photos.deletePhoto({ gallery: gallery.id }, photo.id);

    expect(
      await prisma.photo.findUnique({ where: { id: photo.id } }),
    ).toBeNull();
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  it("is a no-op for a missing photo", async () => {
    const gallery = await seedGallery();

    await photos.deletePhoto({ gallery: gallery.id }, "does-not-exist");

    expect(deleteFilesMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("photos.deleteAllPhotos — gallery container", () => {
  it("removes every row and all stored files", async () => {
    const gallery = await seedGallery("spring");
    await seedGalleryPhoto(gallery.id, { fileKey: "key-1" });
    await seedGalleryPhoto(gallery.id, { fileKey: "key-2" });
    await seedGalleryPhoto(gallery.id, { fileKey: null });

    await photos.deleteAllPhotos({ gallery: gallery.id });

    expect(await prisma.photo.count({ where: { galleryId: gallery.id } })).toBe(
      0,
    );
    expect(deleteFilesMock).toHaveBeenCalledWith(["key-1", "key-2"]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery/spring");
  });

  it("does not call the file API when there are no keys", async () => {
    const gallery = await seedGallery();

    await photos.deleteAllPhotos({ gallery: gallery.id });

    expect(deleteFilesMock).not.toHaveBeenCalled();
  });
});

describe("photos.reorderPhotos — gallery container", () => {
  it("persists the given sort order", async () => {
    const gallery = await seedGallery("spring");
    const a = await seedGalleryPhoto(gallery.id, { sortOrder: 0 });
    const b = await seedGalleryPhoto(gallery.id, { sortOrder: 1 });

    await photos.reorderPhotos({ gallery: gallery.id }, [
      { id: a.id, sortOrder: 5 },
      { id: b.id, sortOrder: 3 },
    ]);

    expect(
      (await prisma.photo.findUnique({ where: { id: a.id } }))?.sortOrder,
    ).toBe(5);
    expect(
      (await prisma.photo.findUnique({ where: { id: b.id } }))?.sortOrder,
    ).toBe(3);
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/galleries/${gallery.id}`,
    );
  });
});

describe("photos.countPhotos — gallery container", () => {
  it("counts photos in the container", async () => {
    const gallery = await seedGallery();
    await seedGalleryPhoto(gallery.id);
    await seedGalleryPhoto(gallery.id);

    expect(await photos.countPhotos({ gallery: gallery.id })).toBe(2);
  });
});

describe("photos.deletePhoto — portfolio container", () => {
  it("clears the cover when deleting the cover photo", async () => {
    const portfolio = await seedPortfolio("weddings");
    const cover = await seedPortfolioPhoto(portfolio.id, { fileKey: "key-c" });
    await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { coverPhotoId: cover.id },
    });

    await photos.deletePhoto({ portfolio: portfolio.id }, cover.id);

    expect(
      await prisma.portfolioPhoto.findUnique({ where: { id: cover.id } }),
    ).toBeNull();
    expect(deleteFilesMock).toHaveBeenCalledWith("key-c");
    expect(
      (await prisma.portfolio.findUnique({ where: { id: portfolio.id } }))
        ?.coverPhotoId,
    ).toBeNull();
  });

  it("leaves the cover untouched when deleting a non-cover photo", async () => {
    const portfolio = await seedPortfolio("weddings");
    const cover = await seedPortfolioPhoto(portfolio.id, { fileKey: "key-c" });
    const other = await seedPortfolioPhoto(portfolio.id, { fileKey: "key-o" });
    await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { coverPhotoId: cover.id },
    });

    await photos.deletePhoto({ portfolio: portfolio.id }, other.id);

    expect(
      (await prisma.portfolio.findUnique({ where: { id: portfolio.id } }))
        ?.coverPhotoId,
    ).toBe(cover.id);
  });
});

describe("photos.deleteAllPhotos — portfolio container", () => {
  it("removes every row, all files, and clears the cover", async () => {
    const portfolio = await seedPortfolio("weddings");
    const a = await seedPortfolioPhoto(portfolio.id, { fileKey: "key-a" });
    await seedPortfolioPhoto(portfolio.id, { fileKey: "key-b" });
    await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { coverPhotoId: a.id },
    });

    await photos.deleteAllPhotos({ portfolio: portfolio.id });

    expect(
      await prisma.portfolioPhoto.count({
        where: { portfolioId: portfolio.id },
      }),
    ).toBe(0);
    expect(deleteFilesMock).toHaveBeenCalledWith(["key-a", "key-b"]);
    expect(
      (await prisma.portfolio.findUnique({ where: { id: portfolio.id } }))
        ?.coverPhotoId,
    ).toBeNull();
  });
});

describe("photos.reorderPhotos — portfolio container", () => {
  it("persists the given sort order", async () => {
    const portfolio = await seedPortfolio("weddings");
    const a = await seedPortfolioPhoto(portfolio.id, { sortOrder: 0 });
    const b = await seedPortfolioPhoto(portfolio.id, { sortOrder: 1 });

    await photos.reorderPhotos({ portfolio: portfolio.id }, [
      { id: a.id, sortOrder: 9 },
      { id: b.id, sortOrder: 4 },
    ]);

    expect(
      (await prisma.portfolioPhoto.findUnique({ where: { id: a.id } }))
        ?.sortOrder,
    ).toBe(9);
    expect(
      (await prisma.portfolioPhoto.findUnique({ where: { id: b.id } }))
        ?.sortOrder,
    ).toBe(4);
  });
});

describe("photos.countPhotos — portfolio container", () => {
  it("counts photos in the container", async () => {
    const portfolio = await seedPortfolio();
    await seedPortfolioPhoto(portfolio.id);

    expect(await photos.countPhotos({ portfolio: portfolio.id })).toBe(1);
  });
});

describe("photos module — public path revalidation", () => {
  it("revalidates the portfolio's public detail and group pages", async () => {
    const group = await prisma.portfolioGroup.create({
      data: { title: "Love", slug: "love", updatedAt: new Date() },
    });
    const portfolio = await seedPortfolio("weddings", group.id);
    const photo = await seedPortfolioPhoto(portfolio.id);

    await photos.deletePhoto({ portfolio: portfolio.id }, photo.id);

    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/portfolio/love");
    expect(revalidatePathMock).toHaveBeenCalledWith("/portfolio/love/weddings");
  });
});
