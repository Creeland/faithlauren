import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ groupSlug: string; portfolioSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portfolioSlug } = await params;
  const portfolio = await prisma.portfolio.findUnique({
    where: { slug: portfolioSlug },
    select: { title: true },
  });

  if (!portfolio) return {};

  return {
    title: `${portfolio.title} — Faith Lauren Photography`,
  };
}

export default async function PortfolioPage({ params }: Props) {
  const { groupSlug, portfolioSlug } = await params;

  const portfolio = await prisma.portfolio.findUnique({
    where: { slug: portfolioSlug },
    include: {
      group: { select: { slug: true, title: true } },
      photos: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!portfolio) notFound();

  // Verify this portfolio belongs to the group in the URL
  if (!portfolio.group || portfolio.group.slug !== groupSlug) notFound();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg tracking-widest uppercase font-light"
          >
            Faith Lauren
          </Link>
          <h1 className="text-sm text-stone-500">{portfolio.title}</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {portfolio.photos.length === 0 ? (
          <p className="text-stone-500 text-sm">
            No photos in this portfolio yet.
          </p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
            {portfolio.photos.map((photo, index) =>
              photo.width && photo.height ? (
                <div
                  key={photo.id}
                  className="break-inside-avoid mb-3 overflow-hidden bg-stone-100"
                >
                  <Image
                    src={photo.url}
                    alt={photo.filename}
                    width={photo.width}
                    height={photo.height}
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="w-full h-auto"
                    priority={index < 3}
                    loading={index < 3 ? undefined : "lazy"}
                  />
                </div>
              ) : (
                <div
                  key={photo.id}
                  className="relative aspect-[3/4] break-inside-avoid mb-3 overflow-hidden bg-stone-100"
                >
                  <Image
                    src={photo.url}
                    alt={photo.filename}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="object-cover"
                    priority={index < 3}
                    loading={index < 3 ? undefined : "lazy"}
                  />
                </div>
              ),
            )}
          </div>
        )}

        <p className="mt-10">
          <Link
            href={`/portfolio/${groupSlug}`}
            className="text-sm text-stone-500 hover:text-accent transition-colors"
          >
            &larr; Back to {portfolio.group.title}
          </Link>
        </p>
      </main>
    </div>
  );
}
