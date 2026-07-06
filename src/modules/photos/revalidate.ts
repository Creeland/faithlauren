import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Container } from "./container";

/**
 * Revalidate every page whose content depends on a container's photos, so a
 * caller can never forget one. Each mutating photo operation calls this after
 * it writes.
 *
 * The admin detail page is revalidated exactly as the old actions did. In
 * addition — and this is the point of owning revalidation inside the module —
 * the public page that renders the photos is revalidated too: the gallery's
 * client page, or the portfolio's public detail/group pages plus the homepage
 * (which surfaces group covers). The old actions only refreshed the admin view,
 * so a photo change could sit stale on the public site until something else
 * revalidated it; that gap closes here.
 */
export async function revalidateContainer(container: Container): Promise<void> {
  if ("gallery" in container) {
    const galleryId = container.gallery;
    revalidatePath(`/admin/galleries/${galleryId}`);

    const gallery = await prisma.gallery.findUnique({
      where: { id: galleryId },
      select: { slug: true },
    });
    if (gallery) {
      revalidatePath(`/gallery/${gallery.slug}`);
    }
    return;
  }

  const portfolioId = container.portfolio;
  revalidatePath(`/admin/portfolios/${portfolioId}`);
  revalidatePath("/");

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: { slug: true, group: { select: { slug: true } } },
  });
  if (portfolio?.group) {
    revalidatePath(`/portfolio/${portfolio.group.slug}`);
    revalidatePath(`/portfolio/${portfolio.group.slug}/${portfolio.slug}`);
  }
}
