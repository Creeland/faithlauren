import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import Link from "next/link";
import Image from "next/image";
import { GroupList } from "./group-list";

export default async function PortfolioGroupsPage() {
  await verifyAdmin();

  const groups = await prisma.portfolioGroup.findMany({
    include: { _count: { select: { portfolios: true } } },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light tracking-tight">Portfolio Groups</h1>
        <Link
          href="/admin/portfolio-groups/new"
          className="bg-accent text-white px-5 py-2.5 text-sm tracking-wide hover:bg-accent-hover transition-colors"
        >
          New Group
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="text-stone-500 text-sm">No portfolio groups yet.</p>
      ) : (
        <GroupList
          groups={groups.map((g) => ({
            id: g.id,
            title: g.title,
            coverImageUrl: g.coverImageUrl,
            portfolioCount: g._count.portfolios,
            sortOrder: g.sortOrder,
          }))}
        />
      )}
    </div>
  );
}
