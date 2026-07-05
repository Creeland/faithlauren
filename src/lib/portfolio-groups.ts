import { prisma } from "@/lib/prisma";

/**
 * Groups shown on the front page "Selected Work" section: only groups that
 * contain at least one portfolio and have a cover image, in sort order.
 */
export function getFrontPageGroups() {
  return prisma.portfolioGroup.findMany({
    where: {
      portfolios: { some: {} },
      coverImageUrl: { not: null },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      title: true,
      slug: true,
      coverImageUrl: true,
      aspectRatio: true,
    },
  });
}
