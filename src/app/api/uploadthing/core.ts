import { createUploadthing, type FileRouter } from "uploadthing/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recordUpload } from "@/modules/photos";

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
      const { id } = await recordUpload(
        { gallery: metadata.galleryId },
        { url: file.ufsUrl, fileKey: file.key, filename: file.name },
      );
      return { id, filename: file.name };
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
      const { id } = await recordUpload(
        { portfolio: metadata.portfolioId },
        { url: file.ufsUrl, fileKey: file.key, filename: file.name },
      );
      return { id, filename: file.name };
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
