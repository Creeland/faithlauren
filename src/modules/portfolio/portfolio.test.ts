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

  it("stores a description when given one", async () => {
    const { id } = await portfolio.createPortfolio({
      title: "Seniors",
      description: "Senior portraits in Wichita Falls.",
    });
    expect(
      (await prisma.portfolio.findUnique({ where: { id } }))?.description,
    ).toBe("Senior portraits in Wichita Falls.");
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

  it("sets, clears, and leaves the description per the input", async () => {
    const { id } = await portfolio.createPortfolio({ title: "Couples" });

    await portfolio.updatePortfolio(id, {
      title: "Couples",
      description: "Couples photography in Wichita Falls.",
    });
    expect(
      (await prisma.portfolio.findUnique({ where: { id } }))?.description,
    ).toBe("Couples photography in Wichita Falls.");

    // Absent description leaves the stored value alone…
    await portfolio.updatePortfolio(id, { title: "Couples" });
    expect(
      (await prisma.portfolio.findUnique({ where: { id } }))?.description,
    ).toBe("Couples photography in Wichita Falls.");

    // …and an explicit null clears it.
    await portfolio.updatePortfolio(id, {
      title: "Couples",
      description: null,
    });
    expect(
      (await prisma.portfolio.findUnique({ where: { id } }))?.description,
    ).toBeNull();
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

// The public read side: the three portfolio pages read exclusively through
// these queries, which return module-owned view types (no Prisma types) and
// apply the sortOrder ordering invariants.
describe("portfolio.getFrontPageGroups", () => {
  it("returns only groups with a cover and at least one portfolio, in sort order", async () => {
    // Two eligible groups (cover + a portfolio), created in one order then
    // reordered, plus two ineligible ones (no cover / no portfolio).
    const weddings = await portfolio.createGroup({ title: "Weddings" });
    const family = await portfolio.createGroup({ title: "Family" });
    const noCover = await portfolio.createGroup({ title: "No Cover" });
    const noPortfolio = await portfolio.createGroup({ title: "No Portfolio" });

    for (const g of [weddings, family, noCover]) {
      const p = await portfolio.createPortfolio({ title: `p-${g.id}` });
      await portfolio.assignPortfolioToGroup(p.id, g.id);
    }
    await portfolio.setGroupCover(weddings.id, {
      url: "https://utfs.io/f/weddings",
      fileKey: "cover-weddings",
      aspectRatio: "aspect-square",
    });
    await portfolio.setGroupCover(family.id, {
      url: "https://utfs.io/f/family",
      fileKey: "cover-family",
    });
    // noPortfolio has a cover but no portfolio; noCover has a portfolio but no
    // cover — both excluded.
    await portfolio.setGroupCover(noPortfolio.id, {
      url: "https://utfs.io/f/orphan",
      fileKey: "cover-orphan",
    });

    // Put Family ahead of Weddings to prove the ordering comes from sortOrder.
    await portfolio.reorderGroups([
      { id: family.id, sortOrder: 0 },
      { id: weddings.id, sortOrder: 1 },
    ]);

    const groups = await portfolio.getFrontPageGroups();

    expect(groups.map((g) => g.slug)).toEqual(["family", "weddings"]);
    // coverImageUrl is a non-null string in the view type.
    expect(groups[0]).toEqual({
      title: "Family",
      slug: "family",
      coverImageUrl: "https://utfs.io/f/family",
      aspectRatio: "aspect-3/4",
    });
    expect(groups[1].coverImageUrl).toBe("https://utfs.io/f/weddings");
    expect(groups[1].aspectRatio).toBe("aspect-square");
  });
});

describe("portfolio.getPortfolioGroup", () => {
  it("returns the group's portfolios in sort order with each cover (first photo)", async () => {
    const group = await portfolio.createGroup({
      title: "Weddings",
      description: "Big days",
    });
    const spring = await portfolio.createPortfolio({ title: "Spring" });
    const autumn = await portfolio.createPortfolio({ title: "Autumn" });
    await portfolio.assignPortfolioToGroup(spring.id, group.id);
    await portfolio.assignPortfolioToGroup(autumn.id, group.id);

    // Spring has two photos; its cover is the sortOrder-0 one. Autumn has none.
    await prisma.portfolioPhoto.create({
      data: {
        url: "https://utfs.io/f/spring-1",
        filename: "second.jpg",
        portfolioId: spring.id,
        sortOrder: 1,
      },
    });
    await prisma.portfolioPhoto.create({
      data: {
        url: "https://utfs.io/f/spring-0",
        filename: "first.jpg",
        portfolioId: spring.id,
        sortOrder: 0,
      },
    });

    // Autumn before Spring, to prove portfolio ordering follows sortOrder.
    await portfolio.reorderPortfolios([
      { id: autumn.id, sortOrder: 0 },
      { id: spring.id, sortOrder: 1 },
    ]);

    const view = await portfolio.getPortfolioGroup("weddings");

    expect(view).not.toBeNull();
    expect(view!.title).toBe("Weddings");
    expect(view!.description).toBe("Big days");
    expect(view!.portfolios.map((p) => p.slug)).toEqual(["autumn", "spring"]);
    expect(view!.portfolios[0].coverPhotoUrl).toBeNull();
    expect(view!.portfolios[1].coverPhotoUrl).toBe(
      "https://utfs.io/f/spring-0",
    );
  });

  it("returns null for an unknown slug", async () => {
    expect(await portfolio.getPortfolioGroup("nope")).toBeNull();
  });
});

describe("portfolio.getPortfolioBySlug", () => {
  it("returns the portfolio's photos in sort order and its group", async () => {
    const group = await portfolio.createGroup({ title: "Weddings" });
    const p = await portfolio.createPortfolio({ title: "Spring" });
    await portfolio.assignPortfolioToGroup(p.id, group.id);

    await prisma.portfolioPhoto.create({
      data: {
        url: "https://utfs.io/f/b",
        filename: "b.jpg",
        portfolioId: p.id,
        width: 800,
        height: 600,
        sortOrder: 1,
      },
    });
    await prisma.portfolioPhoto.create({
      data: {
        url: "https://utfs.io/f/a",
        filename: "a.jpg",
        portfolioId: p.id,
        sortOrder: 0,
      },
    });

    const view = await portfolio.getPortfolioBySlug("spring");

    expect(view).not.toBeNull();
    expect(view!.title).toBe("Spring");
    expect(view!.group).toEqual({ slug: "weddings", title: "Weddings" });
    expect(view!.photos.map((ph) => ph.url)).toEqual([
      "https://utfs.io/f/a",
      "https://utfs.io/f/b",
    ]);
    // The view exposes only the display fields.
    expect(view!.photos[1]).toEqual({
      id: expect.any(String),
      url: "https://utfs.io/f/b",
      filename: "b.jpg",
      width: 800,
      height: 600,
    });
  });

  it("returns a null group for an ungrouped portfolio", async () => {
    await portfolio.createPortfolio({ title: "Loose" });

    const view = await portfolio.getPortfolioBySlug("loose");

    expect(view).not.toBeNull();
    expect(view!.group).toBeNull();
    expect(view!.photos).toEqual([]);
  });

  it("returns null for an unknown slug", async () => {
    expect(await portfolio.getPortfolioBySlug("nope")).toBeNull();
  });
});

describe("portfolio.getSitemapEntries", () => {
  it("lists groups with portfolios and their nested portfolios, excluding empty groups and ungrouped portfolios", async () => {
    const weddings = await portfolio.createGroup({ title: "Weddings" });
    await portfolio.createGroup({ title: "Empty" });
    const spring = await portfolio.createPortfolio({ title: "Spring" });
    await portfolio.assignPortfolioToGroup(spring.id, weddings.id);
    // Ungrouped portfolios are shared-link only (hidden from navigation), so
    // the sitemap must not advertise them.
    await portfolio.createPortfolio({ title: "Loose" });

    const entries = await portfolio.getSitemapEntries();

    expect(entries.groups).toEqual([
      { slug: "weddings", updatedAt: expect.any(Date) },
    ]);
    expect(entries.portfolios).toEqual([
      { slug: "spring", groupSlug: "weddings", updatedAt: expect.any(Date) },
    ]);
  });
});

describe("portfolio.getGroupMeta / getPortfolioMeta", () => {
  it("returns the group title and description, or null", async () => {
    await portfolio.createGroup({ title: "Weddings", description: "Big days" });

    expect(await portfolio.getGroupMeta("weddings")).toEqual({
      title: "Weddings",
      description: "Big days",
    });
    expect(await portfolio.getGroupMeta("nope")).toBeNull();
  });

  it("returns the portfolio title and description, or null", async () => {
    await portfolio.createPortfolio({
      title: "Spring",
      description: "Spring sessions",
    });

    expect(await portfolio.getPortfolioMeta("spring")).toEqual({
      title: "Spring",
      description: "Spring sessions",
    });
    expect(await portfolio.getPortfolioMeta("nope")).toBeNull();
  });
});
