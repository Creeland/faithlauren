import { createUploadthing, type FileRouter } from "uploadthing/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { addGalleryPhoto, addPortfolioPhoto } from "@/lib/photo-store";

const f = createUploadthing();

const photoUpload = {
  image: { maxFileSize: "64MB", maxFileCount: 20 },
} as const;

export const uploadRouter = {
  galleryPhoto: f(photoUpload)
    .input(z.object({ galleryId: z.string() }))
    .middleware(async ({ input }) => {
      await requireAdmin();

      const gallery = await prisma.gallery.findUnique({
        where: { id: input.galleryId },
      });
      if (!gallery) throw new Error("Gallery not found");

      return { galleryId: input.galleryId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const photo = await addGalleryPhoto(metadata.galleryId, {
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
      });

      const gallery = await prisma.gallery.findUnique({
        where: { id: metadata.galleryId },
        select: { slug: true },
      });
      if (gallery) revalidatePath(`/gallery/${gallery.slug}`);
      revalidatePath(`/admin/galleries/${metadata.galleryId}`);

      return { id: photo.id, filename: file.name };
    }),
  portfolioPhoto: f(photoUpload)
    .input(z.object({ portfolioId: z.string() }))
    .middleware(async ({ input }) => {
      await requireAdmin();

      const portfolio = await prisma.portfolio.findUnique({
        where: { id: input.portfolioId },
      });
      if (!portfolio) throw new Error("Portfolio not found");

      return { portfolioId: input.portfolioId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const photo = await addPortfolioPhoto(metadata.portfolioId, {
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
      });

      const portfolio = await prisma.portfolio.findUnique({
        where: { id: metadata.portfolioId },
        select: { slug: true, group: { select: { slug: true } } },
      });
      if (portfolio?.group) {
        revalidatePath(`/portfolio/${portfolio.group.slug}/${portfolio.slug}`);
        revalidatePath(`/portfolio/${portfolio.group.slug}`);
      }
      revalidatePath("/");
      revalidatePath(`/admin/portfolios/${metadata.portfolioId}`);

      return { id: photo.id, filename: file.name };
    }),
  groupCoverImage: f({
    image: {
      maxFileSize: "64MB",
      maxFileCount: 1,
    },
  })
    .input(z.object({ groupId: z.string() }))
    .middleware(async ({ input }) => {
      await requireAdmin();

      const group = await prisma.portfolioGroup.findUnique({
        where: { id: input.groupId },
      });
      if (!group) throw new Error("Group not found");

      return { groupId: input.groupId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.ufsUrl, fileKey: file.key, groupId: metadata.groupId };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
