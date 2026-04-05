import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockDeleteFiles } = vi.hoisted(() => {
  const mockDeleteFiles = vi.fn();
  return {
    mockDeleteFiles,
    mockPrisma: {
      portfolioGroup: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        aggregate: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      portfolio: {
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
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
vi.mock("uploadthing/server", () => ({
  UTApi: vi.fn().mockImplementation(() => ({ deleteFiles: mockDeleteFiles })),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  createGroup,
  updateGroup,
  deleteGroup,
  reorderGroups,
  setGroupCoverImage,
  assignPortfolioToGroup,
  removePortfolioFromGroup,
} from "./portfolio-group";

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createGroup", () => {
  it("creates a group with auto-generated slug and max sortOrder + 1", async () => {
    mockPrisma.portfolioGroup.findUnique.mockResolvedValue(null);
    mockPrisma.portfolioGroup.aggregate.mockResolvedValue({
      _max: { sortOrder: 2 },
    });
    mockPrisma.portfolioGroup.create.mockResolvedValue({});

    await expect(
      createGroup(undefined, formData({ title: "Wedding Photos" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockPrisma.portfolioGroup.create).toHaveBeenCalledWith({
      data: {
        title: "Wedding Photos",
        slug: "wedding-photos",
        description: undefined,
        sortOrder: 3,
      },
    });
  });

  it("creates first group with sortOrder 0", async () => {
    mockPrisma.portfolioGroup.findUnique.mockResolvedValue(null);
    mockPrisma.portfolioGroup.aggregate.mockResolvedValue({
      _max: { sortOrder: null },
    });
    mockPrisma.portfolioGroup.create.mockResolvedValue({});

    await expect(
      createGroup(undefined, formData({ title: "Portraits" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockPrisma.portfolioGroup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sortOrder: 0 }),
    });
  });

  it("returns error for duplicate slug", async () => {
    mockPrisma.portfolioGroup.findUnique.mockResolvedValue({ id: "existing" });

    const result = await createGroup(
      undefined,
      formData({ title: "Weddings" }),
    );

    expect(result).toEqual({
      error: "A group with this name already exists",
    });
    expect(mockPrisma.portfolioGroup.create).not.toHaveBeenCalled();
  });

  it("returns validation error for empty title", async () => {
    const result = await createGroup(undefined, formData({ title: "" }));

    expect(result?.errors?.title).toBeDefined();
    expect(mockPrisma.portfolioGroup.create).not.toHaveBeenCalled();
  });

  it("creates a group with description", async () => {
    mockPrisma.portfolioGroup.findUnique.mockResolvedValue(null);
    mockPrisma.portfolioGroup.aggregate.mockResolvedValue({
      _max: { sortOrder: null },
    });
    mockPrisma.portfolioGroup.create.mockResolvedValue({});

    await expect(
      createGroup(
        undefined,
        formData({
          title: "Events",
          description: "Corporate and social events",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockPrisma.portfolioGroup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: "Corporate and social events",
      }),
    });
  });
});

describe("updateGroup", () => {
  it("updates title and description", async () => {
    mockPrisma.portfolioGroup.update.mockResolvedValue({});

    const result = await updateGroup(
      undefined,
      formData({
        id: "group-1",
        title: "Updated Title",
        description: "New description",
      }),
    );

    expect(result).toBeUndefined();
    expect(mockPrisma.portfolioGroup.update).toHaveBeenCalledWith({
      where: { id: "group-1" },
      data: { title: "Updated Title", description: "New description" },
    });
  });

  it("returns validation error for empty title", async () => {
    const result = await updateGroup(
      undefined,
      formData({ id: "group-1", title: "" }),
    );

    expect(result?.errors?.title).toBeDefined();
    expect(mockPrisma.portfolioGroup.update).not.toHaveBeenCalled();
  });
});

describe("deleteGroup", () => {
  it("blocks deletion when group contains portfolios", async () => {
    mockPrisma.portfolio.count.mockResolvedValue(3);

    const result = await deleteGroup(undefined, formData({ id: "group-1" }));

    expect(result?.error).toMatch(/cannot delete/i);
    expect(mockPrisma.portfolioGroup.delete).not.toHaveBeenCalled();
  });

  it("succeeds when group is empty", async () => {
    mockPrisma.portfolio.count.mockResolvedValue(0);
    mockPrisma.portfolioGroup.findUnique.mockResolvedValue({
      coverImageFileKey: null,
    });
    mockPrisma.portfolioGroup.delete.mockResolvedValue({});

    await expect(
      deleteGroup(undefined, formData({ id: "group-1" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mockPrisma.portfolioGroup.delete).toHaveBeenCalledWith({
      where: { id: "group-1" },
    });
  });

  it("cleans up cover image via UploadThing on delete", async () => {
    mockPrisma.portfolio.count.mockResolvedValue(0);
    mockPrisma.portfolioGroup.findUnique.mockResolvedValue({
      coverImageFileKey: "file-key-123",
    });
    mockPrisma.portfolioGroup.delete.mockResolvedValue({});

    await expect(
      deleteGroup(undefined, formData({ id: "group-1" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockDeleteFiles).toHaveBeenCalledWith(["file-key-123"]);
    expect(mockPrisma.portfolioGroup.delete).toHaveBeenCalled();
  });
});

describe("reorderGroups", () => {
  it("updates sortOrder for multiple groups", async () => {
    mockPrisma.portfolioGroup.update.mockResolvedValue({});

    const order = [
      { id: "g1", sortOrder: 0 },
      { id: "g2", sortOrder: 1 },
      { id: "g3", sortOrder: 2 },
    ];

    await reorderGroups(formData({ order: JSON.stringify(order) }));

    expect(mockPrisma.portfolioGroup.update).toHaveBeenCalledTimes(3);
    expect(mockPrisma.portfolioGroup.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { sortOrder: 0 },
    });
    expect(mockPrisma.portfolioGroup.update).toHaveBeenCalledWith({
      where: { id: "g2" },
      data: { sortOrder: 1 },
    });
    expect(mockPrisma.portfolioGroup.update).toHaveBeenCalledWith({
      where: { id: "g3" },
      data: { sortOrder: 2 },
    });
  });
});

describe("setGroupCoverImage", () => {
  it("sets cover image url, file key, and aspect ratio", async () => {
    mockPrisma.portfolioGroup.findUnique.mockResolvedValue({
      coverImageFileKey: null,
    });
    mockPrisma.portfolioGroup.update.mockResolvedValue({});

    await setGroupCoverImage(
      formData({
        groupId: "group-1",
        url: "https://example.com/image.jpg",
        fileKey: "new-key",
        aspectRatio: "aspect-2/3",
      }),
    );

    expect(mockPrisma.portfolioGroup.update).toHaveBeenCalledWith({
      where: { id: "group-1" },
      data: {
        coverImageUrl: "https://example.com/image.jpg",
        coverImageFileKey: "new-key",
        aspectRatio: "aspect-2/3",
      },
    });
  });
});

describe("assignPortfolioToGroup", () => {
  it("assigns a portfolio to a group", async () => {
    mockPrisma.portfolio.update.mockResolvedValue({});

    await assignPortfolioToGroup(
      formData({ portfolioId: "p1", groupId: "g1" }),
    );

    expect(mockPrisma.portfolio.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { groupId: "g1" },
    });
  });

  it("reassigning to a new group removes from old group (single-group constraint)", async () => {
    mockPrisma.portfolio.update.mockResolvedValue({});

    // First assign to group 1
    await assignPortfolioToGroup(
      formData({ portfolioId: "p1", groupId: "g1" }),
    );

    // Then assign to group 2 — the update simply sets the new groupId
    await assignPortfolioToGroup(
      formData({ portfolioId: "p1", groupId: "g2" }),
    );

    expect(mockPrisma.portfolio.update).toHaveBeenLastCalledWith({
      where: { id: "p1" },
      data: { groupId: "g2" },
    });
  });
});

describe("removePortfolioFromGroup", () => {
  it("removes a portfolio from its group", async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue({ groupId: "g1" });
    mockPrisma.portfolio.update.mockResolvedValue({});

    await removePortfolioFromGroup(formData({ portfolioId: "p1" }));

    expect(mockPrisma.portfolio.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { groupId: null },
    });
  });
});
