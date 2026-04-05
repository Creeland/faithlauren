import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import Image from "next/image";
import Link from "next/link";

export default async function PortfoliosPage() {
  await verifyAdmin();

  const portfolios = await prisma.portfolio.findMany({
    include: {
      _count: { select: { photos: true } },
      photos: true,
      group: { select: { id: true, title: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light tracking-tight">Portfolios</h1>
        <Link
          href="/admin/portfolios/new"
          className="bg-accent text-white px-5 py-2.5 text-sm tracking-wide hover:bg-accent-hover transition-colors"
        >
          New Portfolio
        </Link>
      </div>

      {portfolios.length === 0 ? (
        <p className="text-stone-500 text-sm">No portfolios yet.</p>
      ) : (
        <div className="border border-stone-200 divide-y divide-stone-200">
          {portfolios.map((portfolio) => {
            const coverPhoto = portfolio.coverPhotoId
              ? portfolio.photos.find((p) => p.id === portfolio.coverPhotoId)
              : null;

            return (
              <Link
                key={portfolio.id}
                href={`/admin/portfolios/${portfolio.id}`}
                className="flex items-center gap-4 p-4 hover:bg-accent-subtle transition-colors"
              >
                <div className="w-12 h-12 shrink-0 bg-stone-100 overflow-hidden relative">
                  {coverPhoto ? (
                    <Image
                      src={coverPhoto.url}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">
                      —
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{portfolio.title}</p>
                  <p className="text-xs text-stone-500 mt-1">
                    {portfolio._count.photos} photo
                    {portfolio._count.photos !== 1 ? "s" : ""} &middot;{" "}
                    {portfolio.group ? (
                      <span className="text-accent">
                        {portfolio.group.title}
                      </span>
                    ) : (
                      <span className="text-stone-400">Ungrouped</span>
                    )}{" "}
                    &middot; Order: {portfolio.sortOrder}
                  </p>
                </div>
                <p className="text-xs text-stone-400 shrink-0 hidden sm:block">
                  /portfolio/{portfolio.slug}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
