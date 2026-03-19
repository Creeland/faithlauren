import { createUploadthing, type FileRouter } from "uploadthing/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const f = createUploadthing()

export const uploadRouter = {
  galleryPhoto: f({
    image: {
      maxFileSize: "16MB",
      maxFileCount: 40,
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

      const currentMax = await prisma.photo.aggregate({
        where: { galleryId: input.galleryId },
        _max: { sortOrder: true },
      })

      return {
        galleryId: input.galleryId,
        nextSortOrder: (currentMax._max.sortOrder ?? -1) + 1,
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await prisma.photo.create({
        data: {
          url: file.ufsUrl,
          fileKey: file.key,
          filename: file.name,
          galleryId: metadata.galleryId,
          sortOrder: metadata.nextSortOrder,
        },
      })
    }),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
