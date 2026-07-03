"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import { deleteStoredFiles } from "@/lib/storage";
import { persistOrder } from "@/lib/sortable";

export async function deletePortfolioPhoto(formData: FormData) {
  await verifyAdmin();
  const id = formData.get("id") as string;
  const photo = await prisma.portfolioPhoto.findUnique({ where: { id } });

  if (photo) {
    await deleteStoredFiles([photo.fileKey]);

    // Null out coverPhotoId if this was the cover
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: photo.portfolioId },
    });
    if (portfolio?.coverPhotoId === id) {
      await prisma.portfolio.update({
        where: { id: photo.portfolioId },
        data: { coverPhotoId: null },
      });
    }

    await prisma.portfolioPhoto.delete({ where: { id } });
    revalidatePath(`/admin/portfolios/${photo.portfolioId}`);
  }
}

export async function deleteAllPortfolioPhotos(formData: FormData) {
  await verifyAdmin();
  const portfolioId = formData.get("portfolioId") as string;

  const photos = await prisma.portfolioPhoto.findMany({
    where: { portfolioId },
    select: { fileKey: true },
  });
  await deleteStoredFiles(photos.map((p) => p.fileKey));

  await prisma.portfolioPhoto.deleteMany({ where: { portfolioId } });
  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: { coverPhotoId: null },
  });

  revalidatePath(`/admin/portfolios/${portfolioId}`);
}

export async function getPortfolioPhotoCount(
  portfolioId: string,
): Promise<number> {
  await verifyAdmin();
  return prisma.portfolioPhoto.count({ where: { portfolioId } });
}

export async function reorderPortfolioPhotos(formData: FormData) {
  await verifyAdmin();
  await persistOrder(prisma.portfolioPhoto, formData);

  const portfolioId = formData.get("portfolioId") as string;
  revalidatePath(`/admin/portfolios/${portfolioId}`);
}
