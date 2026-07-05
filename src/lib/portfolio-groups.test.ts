import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    portfolioGroup: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { getFrontPageGroups } from "./portfolio-groups";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFrontPageGroups", () => {
  it("only returns groups with at least one portfolio", async () => {
    mockPrisma.portfolioGroup.findMany.mockResolvedValue([]);

    await getFrontPageGroups();

    expect(mockPrisma.portfolioGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          portfolios: { some: {} },
        }),
      }),
    );
  });

  it("excludes groups without a cover image", async () => {
    mockPrisma.portfolioGroup.findMany.mockResolvedValue([]);

    await getFrontPageGroups();

    expect(mockPrisma.portfolioGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          coverImageUrl: { not: null },
        }),
      }),
    );
  });

  it("orders groups by sortOrder ascending", async () => {
    mockPrisma.portfolioGroup.findMany.mockResolvedValue([]);

    await getFrontPageGroups();

    expect(mockPrisma.portfolioGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { sortOrder: "asc" },
      }),
    );
  });

  it("returns the groups from the database", async () => {
    const groups = [
      {
        title: "Weddings",
        slug: "weddings",
        coverImageUrl: "https://example.com/cover.jpg",
        aspectRatio: "aspect-3/4",
      },
    ];
    mockPrisma.portfolioGroup.findMany.mockResolvedValue(groups);

    await expect(getFrontPageGroups()).resolves.toEqual(groups);
  });
});
