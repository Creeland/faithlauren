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

const { prismaHolder } = vi.hoisted(() => ({
  prismaHolder: {} as { prisma?: PrismaClient },
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaHolder.prisma;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("uploadthing/server", () => ({
  UTApi: vi.fn(() => ({ deleteFiles: vi.fn() })),
}));

import { createTestDb } from "@/test/sqlite-harness";
import { GET } from "./route";

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
  await prisma.portfolioPhoto.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.portfolioGroup.deleteMany();
});

describe("GET /sitemap.xml", () => {
  it("returns XML listing home, group pages, and nested portfolio pages", async () => {
    const group = await prisma.portfolioGroup.create({
      data: { title: "Weddings", slug: "weddings" },
    });
    await prisma.portfolio.create({
      data: { title: "Spring", slug: "spring", groupId: group.id },
    });

    const response = await GET();

    expect(response.headers.get("Content-Type")).toBe("application/xml");
    const xml = await response.text();
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(xml).toContain("<loc>https://faithlauren.photography</loc>");
    expect(xml).toContain(
      "<loc>https://faithlauren.photography/portfolio/weddings</loc>",
    );
    expect(xml).toContain(
      "<loc>https://faithlauren.photography/portfolio/weddings/spring</loc>",
    );
    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T[\d:.]+Z<\/lastmod>/);
  });

  it("lists only the home page when nothing is published", async () => {
    const response = await GET();

    const xml = await response.text();
    expect(xml).toContain("<loc>https://faithlauren.photography</loc>");
    expect(xml).not.toContain("/portfolio/");
  });
});
