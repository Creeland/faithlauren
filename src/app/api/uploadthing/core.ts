import { createUploadthing, type FileRouter } from "uploadthing/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const f = createUploadthing();

export const uploadRouter = {
  galleryPhoto: f({
    image: {
      maxFileSize: "64MB",
      maxFileCount: 20,
    },
  })
    .input(z.object({ galleryId: z.string() }))
    .middleware(async ({ input }) => {
      const session = await auth();
      if (!session?.user || (session.user as any).role !== "ADMIN") {
        throw new Error("Unauthorized");
      }

      const gallery = await prisma.gallery.findUnique({
        where: { id: input.galleryId },
      });
      if (!gallery) throw new Error("Gallery not found");

      return { galleryId: input.galleryId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const photo = await prisma.$transaction(async (tx) => {
        const currentMax = await tx.photo.aggregate({
          where: { galleryId: metadata.galleryId },
          _max: { sortOrder: true },
        });
        return tx.photo.create({
          data: {
            url: file.ufsUrl,
            fileKey: file.key,
            filename: file.name,
            galleryId: metadata.galleryId,
            sortOrder: (currentMax._max.sortOrder ?? -1) + 1,
          },
        });
      });

      const gallery = await prisma.gallery.findUnique({
        where: { id: metadata.galleryId },
        select: { slug: true },
      });
      if (gallery) revalidatePath(`/gallery/${gallery.slug}`);
      revalidatePath(`/admin/galleries/${metadata.galleryId}`);

      // Backfill dimensions async — don't block the upload response
      import("sharp").then(({ default: sharp }) =>
        fetch(file.ufsUrl)
          .then((res) => res.arrayBuffer())
          .then((buf) => sharp(Buffer.from(buf)).metadata())
          .then((meta) => {
            if (meta.width && meta.height) {
              return prisma.photo.update({
                where: { id: photo.id },
                data: { width: meta.width, height: meta.height },
              });
            }
          })
          .catch(() => {}),
      );

      return { id: photo.id, filename: file.name };
    }),
  portfolioPhoto: f({
    image: {
      maxFileSize: "64MB",
      maxFileCount: 20,
    },
  })
    .input(z.object({ portfolioId: z.string() }))
    .middleware(async ({ input }) => {
      const session = await auth();
      if (!session?.user || (session.user as any).role !== "ADMIN") {
        throw new Error("Unauthorized");
      }

      const portfolio = await prisma.portfolio.findUnique({
        where: { id: input.portfolioId },
      });
      if (!portfolio) throw new Error("Portfolio not found");

      return { portfolioId: input.portfolioId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const photo = await prisma.$transaction(async (tx) => {
        const currentMax = await tx.portfolioPhoto.aggregate({
          where: { portfolioId: metadata.portfolioId },
          _max: { sortOrder: true },
        });
        return tx.portfolioPhoto.create({
          data: {
            url: file.ufsUrl,
            fileKey: file.key,
            filename: file.name,
            portfolioId: metadata.portfolioId,
            sortOrder: (currentMax._max.sortOrder ?? -1) + 1,
          },
        });
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

      // Backfill dimensions async — don't block the upload response
      import("sharp").then(({ default: sharp }) =>
        fetch(file.ufsUrl)
          .then((res) => res.arrayBuffer())
          .then((buf) => sharp(Buffer.from(buf)).metadata())
          .then((meta) => {
            if (meta.width && meta.height) {
              return prisma.portfolioPhoto.update({
                where: { id: photo.id },
                data: { width: meta.width, height: meta.height },
              });
            }
          })
          .catch(() => {}),
      );

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
      const session = await auth();
      if (!session?.user || (session.user as any).role !== "ADMIN") {
        throw new Error("Unauthorized");
      }

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
