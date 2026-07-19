import { notFound } from "next/navigation";
import {
  getPortfolioBySlug,
  getPortfolioMeta,
  getSitemapEntries,
} from "@/modules/portfolio";
import { PortfolioView } from "../../portfolio-view";
import { portfolioDescription } from "@/lib/site";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ groupSlug: string; portfolioSlug: string }>;
};

// Prerender every grouped portfolio at build time. Without this the route
// renders on demand at every request (no-store, ~seconds of TTFB), which makes
// crawlers deprioritize the pages. Content changes stay fresh via the
// revalidatePath wiring in the portfolio/photos modules. Slugs not listed here
// (portfolios created after the build) still render on demand and are cached.
export async function generateStaticParams() {
  const { portfolios } = await getSitemapEntries();
  return portfolios.map((portfolio) => ({
    groupSlug: portfolio.groupSlug,
    portfolioSlug: portfolio.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupSlug, portfolioSlug } = await params;
  const portfolio = await getPortfolioMeta(portfolioSlug);

  if (!portfolio) return {};

  return {
    title: portfolio.title,
    description: portfolio.description ?? portfolioDescription(portfolio.title),
    alternates: { canonical: `/portfolio/${groupSlug}/${portfolioSlug}` },
  };
}

export default async function PortfolioPage({ params }: Props) {
  const { groupSlug, portfolioSlug } = await params;

  const portfolio = await getPortfolioBySlug(portfolioSlug);

  if (!portfolio) notFound();

  // Verify this portfolio belongs to the group in the URL
  if (!portfolio.group || portfolio.group.slug !== groupSlug) notFound();

  return (
    <PortfolioView
      title={portfolio.title}
      description={portfolio.description}
      photos={portfolio.photos}
      backHref={`/portfolio/${groupSlug}`}
      backLabel={`Back to ${portfolio.group.title}`}
    />
  );
}
