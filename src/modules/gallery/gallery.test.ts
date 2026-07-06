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

// Real PrismaClient over a throwaway SQLite database — no Prisma mocks. Only
// genuine externals are mocked: UploadThing (for the delegated file cleanup)
// and Next's cache. Mirrors the photos-module interface tests.
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
import * as gallery from "@/modules/gallery";
import { DuplicateSlugError } from "@/modules/shared/errors";
import {
  decryptGalleryPassword,
  isEncryptedGalleryPassword,
} from "@/lib/gallery-access";

const db = createTestDb();
prismaHolder.prisma = db.prisma;
const prisma = db.prisma;

beforeAll(async () => {
  await db.push();
  // encryptGalleryPassword derives its key from this secret.
  process.env.GALLERY_ACCESS_SECRET = "test-secret";
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  vi.clearAllMocks();
  // Children first for the foreign keys.
  await prisma.photo.deleteMany();
  await prisma.gallery.deleteMany();
});

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

describe("gallery.createGallery", () => {
  it("derives a slug from the title and stores an encrypted password", async () => {
    const { id } = await gallery.createGallery({
      title: "Smith Wedding 2026!",
      description: "The big day",
    });

    const created = await prisma.gallery.findUnique({ where: { id } });
    expect(created?.slug).toBe("smith-wedding-2026");
    expect(created?.title).toBe("Smith Wedding 2026!");
    expect(created?.description).toBe("The big day");
    expect(isEncryptedGalleryPassword(created!.password)).toBe(true);
    // The generated password is 16 hex chars before encryption.
    expect(decryptGalleryPassword(created!.password)).toMatch(/^[0-9a-f]{16}$/);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/galleries");
  });

  it("stores a null description when none is given", async () => {
    const { id } = await gallery.createGallery({ title: "No Desc" });

    expect(
      (await prisma.gallery.findUnique({ where: { id } }))?.description,
    ).toBeNull();
  });

  it("throws DuplicateSlugError when the title's slug already exists", async () => {
    await gallery.createGallery({ title: "Jones Family" });

    // A different title that slugifies to the same value collides too.
    await expect(
      gallery.createGallery({ title: "  Jones   Family  " }),
    ).rejects.toBeInstanceOf(DuplicateSlugError);

    expect(await prisma.gallery.count()).toBe(1);
  });

  it("gives each created gallery a distinct password", async () => {
    const a = await gallery.createGallery({ title: "Alpha" });
    const b = await gallery.createGallery({ title: "Beta" });

    const rowA = await prisma.gallery.findUnique({ where: { id: a.id } });
    const rowB = await prisma.gallery.findUnique({ where: { id: b.id } });
    expect(decryptGalleryPassword(rowA!.password)).not.toBe(
      decryptGalleryPassword(rowB!.password),
    );
  });
});

describe("gallery.updateGallery", () => {
  it("updates title and description without changing the slug", async () => {
    const { id } = await gallery.createGallery({ title: "Original Title" });

    await gallery.updateGallery(id, {
      title: "Renamed Title",
      description: "Now with a description",
    });

    const updated = await prisma.gallery.findUnique({ where: { id } });
    expect(updated?.title).toBe("Renamed Title");
    expect(updated?.description).toBe("Now with a description");
    expect(updated?.slug).toBe("original-title");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/galleries/${id}`);
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery/original-title");
  });

  it("clears the description when given an empty string", async () => {
    const { id } = await gallery.createGallery({
      title: "Has Desc",
      description: "something",
    });

    await gallery.updateGallery(id, { title: "Has Desc", description: "" });

    expect(
      (await prisma.gallery.findUnique({ where: { id } }))?.description,
    ).toBeNull();
  });
});

describe("gallery.deleteGallery", () => {
  it("removes all photo files via the photos module, then the rows", async () => {
    const { id } = await gallery.createGallery({ title: "To Delete" });
    await seedGalleryPhoto(id, { fileKey: "key-1" });
    await seedGalleryPhoto(id, { fileKey: "key-2" });
    await seedGalleryPhoto(id, { fileKey: null });

    await gallery.deleteGallery(id);

    expect(deleteFilesMock).toHaveBeenCalledWith(["key-1", "key-2"]);
    expect(await prisma.photo.count({ where: { galleryId: id } })).toBe(0);
    expect(await prisma.gallery.findUnique({ where: { id } })).toBeNull();
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/galleries");
  });

  it("deletes a gallery with no photos without calling the file API", async () => {
    const { id } = await gallery.createGallery({ title: "Empty" });

    await gallery.deleteGallery(id);

    expect(deleteFilesMock).not.toHaveBeenCalled();
    expect(await prisma.gallery.findUnique({ where: { id } })).toBeNull();
  });
});

describe("gallery.regeneratePassword", () => {
  it("replaces the password immediately and revalidates both pages", async () => {
    const { id } = await gallery.createGallery({ title: "Rotate Me" });
    const before = decryptGalleryPassword(
      (await prisma.gallery.findUnique({ where: { id } }))!.password,
    );

    await gallery.regeneratePassword(id);

    const after = (await prisma.gallery.findUnique({ where: { id } }))!;
    const afterPlain = decryptGalleryPassword(after.password);
    expect(afterPlain).not.toBe(before);
    expect(afterPlain).toMatch(/^[0-9a-f]{16}$/);
    expect(isEncryptedGalleryPassword(after.password)).toBe(true);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/galleries/${id}`);
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery/rotate-me");
  });
});
