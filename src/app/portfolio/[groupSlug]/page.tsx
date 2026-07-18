import { notFound, permanentRedirect } from "next/navigation";
import {
  getGroupMeta,
  getPortfolioBySlug,
  getPortfolioGroup,
} from "@/modules/portfolio";
import Image from "next/image";
import Link from "next/link";
import { PortfolioView } from "../portfolio-view";
import { portfolioDescription } from "@/lib/site";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ groupSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupSlug } = await params;
  const group = await getGroupMeta(groupSlug);

  if (group) {
    return {
      title: group.title,
      description: group.description ?? portfolioDescription(group.title),
      alternates: { canonical: `/portfolio/${groupSlug}` },
    };
  }

  // Slug may be a direct link to a portfolio (see fallback in the page below)
  const portfolio = await getPortfolioBySlug(groupSlug);

  if (!portfolio) return {};

  return {
    title: portfolio.title,
    description: portfolioDescription(portfolio.title),
    // Grouped portfolios redirect to their nested URL; point crawlers there.
    alternates: {
      canonical: portfolio.group
        ? `/portfolio/${portfolio.group.slug}/${portfolio.slug}`
        : `/portfolio/${portfolio.slug}`,
    },
  };
}

export default async function GroupPage({ params }: Props) {
  const { groupSlug } = await params;

  const group = await getPortfolioGroup(groupSlug);

  if (!group) {
    // Portfolio slugs are globally unique, so /portfolio/[slug] doubles as
    // the direct URL for ungrouped portfolios (hidden from navigation but
    // reachable via shared links). Grouped portfolios redirect to their
    // canonical nested URL.
    const portfolio = await getPortfolioBySlug(groupSlug);

    if (!portfolio) notFound();

    if (portfolio.group) {
      // 308, not 307: the flat /portfolio/[slug] URL is the portfolio's old
      // address (pre-groups), and a temporary redirect makes Google keep it
      // as the canonical and mark the nested URL a duplicate.
      permanentRedirect(`/portfolio/${portfolio.group.slug}/${portfolio.slug}`);
    }

    return (
      <PortfolioView
        title={portfolio.title}
        photos={portfolio.photos}
        backHref="/"
        backLabel="Back to site"
      />
    );
  }

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
          <h1 className="text-sm text-stone-500">{group.title}</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {group.description && (
          <p className="text-stone-600 leading-relaxed mb-10 max-w-2xl">
            {group.description}
          </p>
        )}

        {group.portfolios.length === 0 ? (
          <p className="text-stone-500 text-sm">
            No portfolios in this group yet.
          </p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 sm:gap-6">
            {group.portfolios.map((portfolio) => {
              const coverUrl = portfolio.coverPhotoUrl;
              return (
                <Link
                  key={portfolio.id}
                  href={`/portfolio/${group.slug}/${portfolio.slug}`}
                  className="group block break-inside-avoid mb-5 sm:mb-6"
                >
                  <div
                    className={`relative ${portfolio.aspectRatio} overflow-hidden bg-stone-100`}
                  >
                    {coverUrl ? (
                      <Image
                        src={coverUrl}
                        alt={`${portfolio.title} photography by Faith Lauren`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-sm">
                        No cover photo
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-900/50 to-transparent sm:from-transparent sm:to-transparent sm:bg-stone-900/0 sm:group-hover:bg-stone-900/20 transition-colors duration-500" />
                    <p className="absolute bottom-0 left-0 right-0 px-5 py-3.5 text-sm tracking-wide text-white translate-y-0 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-500 ease-out">
                      {portfolio.title}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <p className="mt-10">
          <Link
            href="/"
            className="text-sm text-stone-500 hover:text-accent transition-colors"
          >
            &larr; Back to site
          </Link>
        </p>
      </main>
    </div>
  );
}
