import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import zlib from "zlib";
import type { PrismaClient } from "@prisma/client";

// Real PrismaClient over a throwaway SQLite database — no Prisma mocks. Only
// genuine externals are mocked: UploadThing (for the delegated file cleanup)
// and Next's cache. Mirrors the photos-module interface tests.
const { prismaHolder, deleteFilesMock, revalidatePathMock, cookieJar } =
  vi.hoisted(() => ({
    prismaHolder: {} as { prisma?: PrismaClient },
    deleteFilesMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    // A tiny in-memory cookie jar standing in for the request/response cookie
    // store, so grantAccess/hasAccess can round-trip through the real contract.
    cookieJar: new Map<string, string>(),
  }));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaHolder.prisma;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
  }),
}));
vi.mock("uploadthing/server", () => ({
  UTApi: vi.fn(() => ({ deleteFiles: deleteFilesMock })),
}));

import { createTestDb } from "@/test/sqlite-harness";
import * as gallery from "@/modules/gallery";
import {
  DuplicateSlugError,
  InvalidAlbumPasswordError,
  InvalidPhotoSelectionError,
  EmptyDownloadError,
} from "@/modules/shared/errors";
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
  cookieJar.clear();
  // Children first for the foreign keys.
  await prisma.photo.deleteMany();
  await prisma.gallery.deleteMany();
});

// The plaintext client password for a gallery, read back from the stored
// (encrypted) column — createGallery generates it, so tests can't know it up
// front.
async function plaintextPassword(id: string): Promise<string> {
  const row = await prisma.gallery.findUniqueOrThrow({ where: { id } });
  return decryptGalleryPassword(row.password);
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

describe("gallery.getPublicGallery", () => {
  it("returns a view whose shape omits the password", async () => {
    const { id } = await gallery.createGallery({
      title: "Public View",
      description: "shown to clients",
    });
    await seedGalleryPhoto(id, { sortOrder: 0 });

    const view = await gallery.getPublicGallery("public-view");

    expect(view).not.toBeNull();
    // The secret is structurally absent from the returned view.
    expect(view).not.toHaveProperty("password");
    expect(Object.keys(view!).sort()).toEqual([
      "description",
      "id",
      "photos",
      "slug",
      "title",
    ]);
    expect(view!.photos[0]).not.toHaveProperty("fileKey");
  });

  it("returns photos in sortOrder", async () => {
    const { id } = await gallery.createGallery({ title: "Ordered" });
    await prisma.photo.create({
      data: { url: "u2", filename: "second.jpg", galleryId: id, sortOrder: 1 },
    });
    await prisma.photo.create({
      data: { url: "u1", filename: "first.jpg", galleryId: id, sortOrder: 0 },
    });

    const view = await gallery.getPublicGallery("ordered");

    expect(view!.photos.map((p) => p.filename)).toEqual([
      "first.jpg",
      "second.jpg",
    ]);
  });

  it("returns null for an unknown slug", async () => {
    expect(await gallery.getPublicGallery("no-such-gallery")).toBeNull();
  });
});

describe("gallery.verifyPassword / grantAccess / hasAccess", () => {
  it("returns a grant for the correct password", async () => {
    const { id } = await gallery.createGallery({ title: "Unlock Me" });
    const password = await plaintextPassword(id);

    const grant = await gallery.verifyPassword("unlock-me", password);

    expect(grant.slug).toBe("unlock-me");
    expect(grant.token).toMatch(/^[0-9a-f]{64}$/);
    // The grant carries no password.
    expect(grant).not.toHaveProperty("password");
  });

  it("throws InvalidAlbumPasswordError for a wrong password", async () => {
    await gallery.createGallery({ title: "Guarded" });

    await expect(
      gallery.verifyPassword("guarded", "not-the-password"),
    ).rejects.toBeInstanceOf(InvalidAlbumPasswordError);
  });

  it("throws InvalidAlbumPasswordError for an unknown slug", async () => {
    await expect(
      gallery.verifyPassword("missing", "whatever"),
    ).rejects.toBeInstanceOf(InvalidAlbumPasswordError);
  });

  it("re-encrypts a legacy plaintext row on successful verify", async () => {
    const { id } = await gallery.createGallery({ title: "Legacy" });
    // Downgrade the stored column to legacy plaintext.
    await prisma.gallery.update({
      where: { id },
      data: { password: "plainsecret" },
    });

    const grant = await gallery.verifyPassword("legacy", "plainsecret");

    const row = await prisma.gallery.findUniqueOrThrow({ where: { id } });
    expect(isEncryptedGalleryPassword(row.password)).toBe(true);
    expect(decryptGalleryPassword(row.password)).toBe("plainsecret");
    // Re-encryption keeps the same plaintext, so the token is unchanged and
    // any already-issued cookie stays valid.
    expect(grant.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("round-trips: a granted cookie yields hasAccess true; a rotation revokes it", async () => {
    const { id } = await gallery.createGallery({ title: "Round Trip" });
    const password = await plaintextPassword(id);

    expect(await gallery.hasAccess("round-trip")).toBe(false);

    const grant = await gallery.verifyPassword("round-trip", password);
    await gallery.grantAccess(grant);

    expect(cookieJar.get("gallery-round-trip-access")).toBe(grant.token);
    expect(await gallery.hasAccess("round-trip")).toBe(true);
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery/round-trip");

    // Regenerating the password invalidates the previously issued cookie.
    await gallery.regeneratePassword(id);
    expect(await gallery.hasAccess("round-trip")).toBe(false);
  });

  it("hasAccess is false for an unknown slug", async () => {
    expect(await gallery.hasAccess("no-such-gallery")).toBe(false);
  });
});

// --- ZIP download -------------------------------------------------------------

// The server-side fetch of each photo's URL is the one true external in the
// download path. It's stubbed to return a deterministic body per URL so the
// archive's contents can be asserted byte-for-byte after unzipping.
function bodyFor(url: string): Uint8Array {
  return new TextEncoder().encode(`BODY:${url}`);
}

/** Drain a web ReadableStream into a single Buffer. */
async function readStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Minimal ZIP reader: parse the central directory and return each entry's name
 * mapped to its decompressed bytes. No unzip library is available in this
 * sandbox, so the format is parsed directly (deflate entries via zlib).
 */
function readZipEntries(buf: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();

  // Locate the End Of Central Directory record (scanning back from the tail).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP: no end-of-central-directory record");

  const total = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) {
      throw new Error("ZIP: bad central-directory signature");
    }
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);

    // Data offset is derived from the local header's own name/extra lengths.
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries.set(
      name,
      method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw),
    );

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

async function seedPhoto(
  galleryId: string,
  filename: string,
  sortOrder: number,
  overrides: Partial<{ url: string }> = {},
) {
  return prisma.photo.create({
    data: {
      url: overrides.url ?? `https://utfs.io/f/${filename}`,
      filename,
      galleryId,
      fileKey: `key-${filename}`,
      sortOrder,
    },
  });
}

describe("gallery.buildGalleryDownload", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        arrayBuffer: async () => {
          const bytes = bodyFor(url);
          return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          );
        },
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("archives the whole gallery, in order, with each photo's bytes", async () => {
    const { id } = await gallery.createGallery({ title: "Full Set" });
    await seedPhoto(id, "a.jpg", 0);
    await seedPhoto(id, "b.jpg", 1);
    await seedPhoto(id, "c.jpg", 2);

    const download = await gallery.buildGalleryDownload("full-set");
    expect(download).not.toBeNull();
    expect(download!.filename).toBe("Full Set.zip");

    const entries = readZipEntries(await readStream(download!.stream));
    expect([...entries.keys()].sort()).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    expect(entries.get("a.jpg")!.toString()).toBe(
      "BODY:https://utfs.io/f/a.jpg",
    );
    expect(entries.get("b.jpg")!.toString()).toBe(
      "BODY:https://utfs.io/f/b.jpg",
    );
  });

  it("archives exactly the selected subset of photos", async () => {
    const { id } = await gallery.createGallery({ title: "Pick Two" });
    const a = await seedPhoto(id, "a.jpg", 0);
    await seedPhoto(id, "b.jpg", 1);
    const c = await seedPhoto(id, "c.jpg", 2);

    const download = await gallery.buildGalleryDownload("pick-two", [
      a.id,
      c.id,
    ]);

    const entries = readZipEntries(await readStream(download!.stream));
    expect([...entries.keys()].sort()).toEqual(["a.jpg", "c.jpg"]);
    expect(entries.has("b.jpg")).toBe(false);
  });

  it("sanitizes the gallery title into the download filename", async () => {
    const { id } = await gallery.createGallery({
      title: "Smith & Jones: 2026!",
    });
    await seedPhoto(id, "a.jpg", 0);

    const download = await gallery.buildGalleryDownload("smith-jones-2026");
    expect(download!.filename).toBe("Smith  Jones 2026.zip");
  });

  it("throws InvalidPhotoSelectionError for an id outside the gallery", async () => {
    const { id } = await gallery.createGallery({ title: "Guarded Set" });
    await seedPhoto(id, "a.jpg", 0);

    await expect(
      gallery.buildGalleryDownload("guarded-set", ["not-a-real-id"]),
    ).rejects.toBeInstanceOf(InvalidPhotoSelectionError);
  });

  it("throws EmptyDownloadError for a gallery with no photos", async () => {
    await gallery.createGallery({ title: "Nothing Here" });

    await expect(
      gallery.buildGalleryDownload("nothing-here"),
    ).rejects.toBeInstanceOf(EmptyDownloadError);
  });

  it("throws EmptyDownloadError for a selection that matches nothing", async () => {
    const { id } = await gallery.createGallery({ title: "Empty Pick" });
    await seedPhoto(id, "a.jpg", 0);

    // An explicit empty selection is a selection, not a full-gallery request.
    await expect(
      gallery.buildGalleryDownload("empty-pick", []),
    ).rejects.toBeInstanceOf(EmptyDownloadError);
  });

  it("returns null for an unknown slug", async () => {
    expect(await gallery.buildGalleryDownload("no-such-gallery")).toBeNull();
  });

  it("skips photos whose URL is off the upload-host allowlist", async () => {
    const { id } = await gallery.createGallery({ title: "Mixed Hosts" });
    await seedPhoto(id, "ok.jpg", 0);
    await seedPhoto(id, "evil.jpg", 1, { url: "http://169.254.169.254/x.jpg" });

    const download = await gallery.buildGalleryDownload("mixed-hosts");
    const entries = readZipEntries(await readStream(download!.stream));
    expect([...entries.keys()]).toEqual(["ok.jpg"]);
  });

  it("skips photos whose fetch does not succeed", async () => {
    const { id } = await gallery.createGallery({ title: "Flaky Fetch" });
    await seedPhoto(id, "good.jpg", 0);
    await seedPhoto(id, "gone.jpg", 1);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: !url.endsWith("gone.jpg"),
        arrayBuffer: async () => {
          const bytes = bodyFor(url);
          return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          );
        },
      })),
    );

    const download = await gallery.buildGalleryDownload("flaky-fetch");
    const entries = readZipEntries(await readStream(download!.stream));
    expect([...entries.keys()]).toEqual(["good.jpg"]);
  });
});
