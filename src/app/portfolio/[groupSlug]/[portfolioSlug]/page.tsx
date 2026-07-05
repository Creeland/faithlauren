import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PortfolioView } from "../../portfolio-view";
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
    <PortfolioView
      title={portfolio.title}
      photos={portfolio.photos}
      backHref={`/portfolio/${groupSlug}`}
      backLabel={`Back to ${portfolio.group.title}`}
    />
  );
}
