import { createUploadthing, type FileRouter } from "uploadthing/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const f = createUploadthing()

export const uploadRouter = {
  galleryPhoto: f({
    image: {
      maxFileSize: "64MB",
      maxFileCount: 20,
    },
  })
    .input(z.object({ galleryId: z.string() }))
    .middleware(async ({ input }) => {
      const session = await auth()
      if (!session?.user || (session.user as any).role !== "ADMIN") {
        throw new Error("Unauthorized")
      }

      const gallery = await prisma.gallery.findUnique({
        where: { id: input.galleryId },
      })
      if (!gallery) throw new Error("Gallery not found")

      return { galleryId: input.galleryId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const photo = await prisma.$transaction(async (tx) => {
        const currentMax = await tx.photo.aggregate({
          where: { galleryId: metadata.galleryId },
          _max: { sortOrder: true },
        })
        return tx.photo.create({
          data: {
            url: file.ufsUrl,
            fileKey: file.key,
            filename: file.name,
            galleryId: metadata.galleryId,
            sortOrder: (currentMax._max.sortOrder ?? -1) + 1,
          },
        })
      })
      return { id: photo.id, filename: file.name }
    }),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
