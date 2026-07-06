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
import {
  DuplicateSlugError,
  GroupNotEmptyError,
} from "@/modules/shared/errors";

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

describe("portfolio.createGroup", () => {
  it("derives a slug from the title and appends at the end", async () => {
    const first = await portfolio.createGroup({ title: "Wedding Photos" });
    const second = await portfolio.createGroup({ title: "Family Sessions" });

    const rowA = await prisma.portfolioGroup.findUnique({
      where: { id: first.id },
    });
    const rowB = await prisma.portfolioGroup.findUnique({
      where: { id: second.id },
    });
    expect(rowA?.slug).toBe("wedding-photos");
    expect(rowB?.slug).toBe("family-sessions");
    expect(rowA?.sortOrder).toBe(0);
    expect(rowB?.sortOrder).toBe(1);
  });

  it("stores an optional description", async () => {
    const { id } = await portfolio.createGroup({
      title: "Events",
      description: "Corporate and social events",
    });
    const row = await prisma.portfolioGroup.findUnique({ where: { id } });
    expect(row?.description).toBe("Corporate and social events");
  });

  it("throws DuplicateSlugError when the title's slug already exists", async () => {
    await portfolio.createGroup({ title: "Weddings" });

    await expect(
      portfolio.createGroup({ title: "  Weddings  " }),
    ).rejects.toBeInstanceOf(DuplicateSlugError);

    expect(await prisma.portfolioGroup.count()).toBe(1);
  });
});

describe("portfolio.updateGroup", () => {
  it("updates title and description without changing the slug and revalidates", async () => {
    const { id } = await portfolio.createGroup({ title: "Original" });

    await portfolio.updateGroup(id, {
      title: "Renamed",
      description: "New description",
    });

    const row = await prisma.portfolioGroup.findUnique({ where: { id } });
    expect(row?.title).toBe("Renamed");
    expect(row?.description).toBe("New description");
    expect(row?.slug).toBe("original");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/portfolio-groups/${id}`,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/portfolio/original");
  });
});

describe("portfolio.deleteGroup", () => {
  it("throws GroupNotEmptyError when the group still contains portfolios", async () => {
    const { id } = await portfolio.createGroup({ title: "Occupied" });
    const p = await portfolio.createPortfolio({ title: "Inside" });
    await prisma.portfolio.update({
      where: { id: p.id },
      data: { groupId: id },
    });

    await expect(portfolio.deleteGroup(id)).rejects.toBeInstanceOf(
      GroupNotEmptyError,
    );
    expect(
      await prisma.portfolioGroup.findUnique({ where: { id } }),
    ).not.toBeNull();
  });

  it("deletes an empty group without touching the file API", async () => {
    const { id } = await portfolio.createGroup({ title: "Empty" });

    await portfolio.deleteGroup(id);

    expect(deleteFilesMock).not.toHaveBeenCalled();
    expect(
      await prisma.portfolioGroup.findUnique({ where: { id } }),
    ).toBeNull();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("removes the cover image file via UploadThing on delete", async () => {
    const { id } = await portfolio.createGroup({ title: "Has Cover" });
    await prisma.portfolioGroup.update({
      where: { id },
      data: { coverImageFileKey: "cover-key-1" },
    });

    await portfolio.deleteGroup(id);

    expect(deleteFilesMock).toHaveBeenCalledWith(["cover-key-1"]);
    expect(
      await prisma.portfolioGroup.findUnique({ where: { id } }),
    ).toBeNull();
  });
});

describe("portfolio.reorderGroups", () => {
  it("persists the new sort order and revalidates the homepage", async () => {
    const a = await portfolio.createGroup({ title: "First" });
    const b = await portfolio.createGroup({ title: "Second" });
    const c = await portfolio.createGroup({ title: "Third" });

    await portfolio.reorderGroups([
      { id: c.id, sortOrder: 0 },
      { id: b.id, sortOrder: 1 },
      { id: a.id, sortOrder: 2 },
    ]);

    const rows = await prisma.portfolioGroup.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    expect(rows.map((r) => r.id)).toEqual([c.id, b.id, a.id]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/portfolio-groups");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });
});

describe("portfolio.setGroupCover", () => {
  it("sets url, file key, and aspect ratio and revalidates", async () => {
    const { id } = await portfolio.createGroup({ title: "Cover Me" });

    await portfolio.setGroupCover(id, {
      url: "https://example.com/image.jpg",
      fileKey: "new-key",
      aspectRatio: "aspect-2/3",
    });

    const row = await prisma.portfolioGroup.findUnique({ where: { id } });
    expect(row?.coverImageUrl).toBe("https://example.com/image.jpg");
    expect(row?.coverImageFileKey).toBe("new-key");
    expect(row?.aspectRatio).toBe("aspect-2/3");
    expect(deleteFilesMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/portfolio-groups/${id}`,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/portfolio/cover-me`);
  });

  it("deletes the previous cover file when replacing it with a different one", async () => {
    const { id } = await portfolio.createGroup({ title: "Replace" });
    await prisma.portfolioGroup.update({
      where: { id },
      data: { coverImageFileKey: "old-key" },
    });

    await portfolio.setGroupCover(id, {
      url: "https://example.com/new.jpg",
      fileKey: "fresh-key",
    });

    expect(deleteFilesMock).toHaveBeenCalledWith(["old-key"]);
    const row = await prisma.portfolioGroup.findUnique({ where: { id } });
    expect(row?.coverImageFileKey).toBe("fresh-key");
  });
});

describe("portfolio.assignPortfolioToGroup", () => {
  it("assigns a portfolio to a group and revalidates public pages", async () => {
    const group = await portfolio.createGroup({ title: "Weddings" });
    const p = await portfolio.createPortfolio({ title: "Spring" });

    await portfolio.assignPortfolioToGroup(p.id, group.id);

    const row = await prisma.portfolio.findUnique({ where: { id: p.id } });
    expect(row?.groupId).toBe(group.id);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/portfolios");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/portfolio-groups/${group.id}`,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/portfolio/weddings");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/portfolio/weddings/spring",
    );
  });

  it("reassigning moves the portfolio out of its previous group", async () => {
    const g1 = await portfolio.createGroup({ title: "One" });
    const g2 = await portfolio.createGroup({ title: "Two" });
    const p = await portfolio.createPortfolio({ title: "Mover" });

    await portfolio.assignPortfolioToGroup(p.id, g1.id);
    await portfolio.assignPortfolioToGroup(p.id, g2.id);

    const row = await prisma.portfolio.findUnique({ where: { id: p.id } });
    expect(row?.groupId).toBe(g2.id);
  });
});

describe("portfolio.removePortfolioFromGroup", () => {
  it("clears the portfolio's group and revalidates the former group's pages", async () => {
    const group = await portfolio.createGroup({ title: "Weddings" });
    const p = await portfolio.createPortfolio({ title: "Spring" });
    await portfolio.assignPortfolioToGroup(p.id, group.id);
    vi.clearAllMocks();

    await portfolio.removePortfolioFromGroup(p.id);

    const row = await prisma.portfolio.findUnique({ where: { id: p.id } });
    expect(row?.groupId).toBeNull();
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/portfolios");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/portfolio-groups/${group.id}`,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/portfolio/weddings");
  });
});
