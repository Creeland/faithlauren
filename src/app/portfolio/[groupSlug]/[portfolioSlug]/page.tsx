import { notFound } from "next/navigation";
import { getPortfolioBySlug, getPortfolioMeta } from "@/modules/portfolio";
import { PortfolioView } from "../../portfolio-view";
import { portfolioDescription } from "@/lib/site";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ groupSlug: string; portfolioSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupSlug, portfolioSlug } = await params;
  const portfolio = await getPortfolioMeta(portfolioSlug);

  if (!portfolio) return {};

  return {
    title: portfolio.title,
    description: portfolioDescription(portfolio.title),
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
      photos={portfolio.photos}
      backHref={`/portfolio/${groupSlug}`}
      backLabel={`Back to ${portfolio.group.title}`}
    />
  );
}
