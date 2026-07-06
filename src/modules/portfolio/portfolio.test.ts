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
// genuine externals are mocked: UploadThing (for the delegated file cleanup, via
// the photos module) and Next's cache. Mirrors the gallery/photos interface
// tests.
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
import * as portfolio from "@/modules/portfolio";
import { DuplicateSlugError } from "@/modules/shared/errors";

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
  await prisma.portfolioPhoto.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.portfolioGroup.deleteMany();
});

async function seedPortfolioPhoto(
  portfolioId: string,
  overrides: Partial<{ fileKey: string | null; sortOrder: number }> = {},
) {
  return prisma.portfolioPhoto.create({
    data: {
      url: "https://utfs.io/f/abc",
      filename: "a.jpg",
      portfolioId,
      fileKey: "fileKey" in overrides ? overrides.fileKey : "key-a",
      sortOrder: overrides.sortOrder ?? 0,
    },
  });
}

describe("portfolio.createPortfolio", () => {
  it("derives a slug from the title and appends at the end", async () => {
    const first = await portfolio.createPortfolio({ title: "Weddings" });
    const second = await portfolio.createPortfolio({
      title: "Family Sessions",
    });

    const rowA = await prisma.portfolio.findUnique({ where: { id: first.id } });
    const rowB = await prisma.portfolio.findUnique({
      where: { id: second.id },
    });
    expect(rowA?.slug).toBe("weddings");
    expect(rowB?.slug).toBe("family-sessions");
    // Appended: each new portfolio gets one past the current max sortOrder.
    expect(rowA?.sortOrder).toBe(0);
    expect(rowB?.sortOrder).toBe(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/portfolios");
  });

  it("normalizes punctuation and whitespace into the slug", async () => {
    const { id } = await portfolio.createPortfolio({
      title: "Smith & Co. 2026!",
    });
    expect((await prisma.portfolio.findUnique({ where: { id } }))?.slug).toBe(
      "smith-co-2026",
    );
  });

  it("throws DuplicateSlugError when the title's slug already exists", async () => {
    await portfolio.createPortfolio({ title: "Engagements" });

    // A different title that slugifies to the same value collides too.
    await expect(
      portfolio.createPortfolio({ title: "  Engagements  " }),
    ).rejects.toBeInstanceOf(DuplicateSlugError);

    expect(await prisma.portfolio.count()).toBe(1);
  });
});

describe("portfolio.updatePortfolio", () => {
  it("updates the title without changing the slug", async () => {
    const { id } = await portfolio.createPortfolio({ title: "Original Title" });

    await portfolio.updatePortfolio(id, { title: "Renamed Title" });

    const updated = await prisma.portfolio.findUnique({ where: { id } });
    expect(updated?.title).toBe("Renamed Title");
    expect(updated?.slug).toBe("original-title");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/portfolios/${id}`);
  });

  it("revalidates the group's public pages when the portfolio is grouped", async () => {
    const group = await prisma.portfolioGroup.create({
      data: { title: "Group", slug: "group" },
    });
    const { id } = await portfolio.createPortfolio({ title: "Grouped" });
    await prisma.portfolio.update({
      where: { id },
      data: { groupId: group.id },
    });

    await portfolio.updatePortfolio(id, { title: "Grouped" });

    expect(revalidatePathMock).toHaveBeenCalledWith("/portfolio/group");
    expect(revalidatePathMock).toHaveBeenCalledWith("/portfolio/group/grouped");
  });
});

describe("portfolio.deletePortfolio", () => {
  it("removes all photo files via the photos module, then the rows", async () => {
    const { id } = await portfolio.createPortfolio({ title: "To Delete" });
    await seedPortfolioPhoto(id, { fileKey: "key-1" });
    await seedPortfolioPhoto(id, { fileKey: "key-2", sortOrder: 1 });
    await seedPortfolioPhoto(id, { fileKey: null, sortOrder: 2 });

    await portfolio.deletePortfolio(id);

    expect(deleteFilesMock).toHaveBeenCalledWith(["key-1", "key-2"]);
    expect(
      await prisma.portfolioPhoto.count({ where: { portfolioId: id } }),
    ).toBe(0);
    expect(await prisma.portfolio.findUnique({ where: { id } })).toBeNull();
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/portfolios");
  });

  it("deletes a portfolio with no photos without calling the file API", async () => {
    const { id } = await portfolio.createPortfolio({ title: "Empty" });

    await portfolio.deletePortfolio(id);

    expect(deleteFilesMock).not.toHaveBeenCalled();
    expect(await prisma.portfolio.findUnique({ where: { id } })).toBeNull();
  });
});

describe("portfolio.reorderPortfolios", () => {
  it("persists the new sort order for each portfolio", async () => {
    const a = await portfolio.createPortfolio({ title: "First" }); // sortOrder 0
    const b = await portfolio.createPortfolio({ title: "Second" }); // sortOrder 1
    const c = await portfolio.createPortfolio({ title: "Third" }); // sortOrder 2

    // Reverse the order.
    await portfolio.reorderPortfolios([
      { id: c.id, sortOrder: 0 },
      { id: b.id, sortOrder: 1 },
      { id: a.id, sortOrder: 2 },
    ]);

    const rows = await prisma.portfolio.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    expect(rows.map((r) => r.id)).toEqual([c.id, b.id, a.id]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/portfolios");
  });

  it("revalidates the public group page of a reordered portfolio's group", async () => {
    const group = await prisma.portfolioGroup.create({
      data: { title: "Weddings", slug: "weddings" },
    });
    const a = await portfolio.createPortfolio({ title: "Spring" });
    const b = await portfolio.createPortfolio({ title: "Autumn" });
    await prisma.portfolio.updateMany({
      where: { id: { in: [a.id, b.id] } },
      data: { groupId: group.id },
    });

    await portfolio.reorderPortfolios([
      { id: b.id, sortOrder: 0 },
      { id: a.id, sortOrder: 1 },
    ]);

    expect(revalidatePathMock).toHaveBeenCalledWith("/portfolio/weddings");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });
});
