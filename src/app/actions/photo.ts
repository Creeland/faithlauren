"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { verifyAdmin } from "@/lib/dal"
import { UTApi } from "uploadthing/server"

const utapi = new UTApi()

export async function deletePhoto(formData: FormData) {
  await verifyAdmin()
  const id = formData.get("id") as string
  const photo = await prisma.photo.findUnique({ where: { id } })

  if (photo) {
    if (photo.fileKey) {
      await utapi.deleteFiles(photo.fileKey)
    }
    await prisma.photo.delete({ where: { id } })
    revalidatePath(`/admin/galleries/${photo.galleryId}`)
  }
}

export async function deleteAllPhotos(formData: FormData) {
  await verifyAdmin()
  const galleryId = formData.get("galleryId") as string

  const photos = await prisma.photo.findMany({
    where: { galleryId },
    select: { fileKey: true },
  })

  const fileKeys = photos.map((p) => p.fileKey).filter(Boolean) as string[]
  if (fileKeys.length > 0) {
    await utapi.deleteFiles(fileKeys)
  }

  await prisma.photo.deleteMany({ where: { galleryId } })
  revalidatePath(`/admin/galleries/${galleryId}`)
}

export async function getPhotoCount(galleryId: string): Promise<number> {
  await verifyAdmin()
  return prisma.photo.count({ where: { galleryId } })
}

export async function reorderPhotos(formData: FormData) {
  await verifyAdmin()
  const order = JSON.parse(formData.get("order") as string) as {
    id: string
    sortOrder: number
  }[]

  await Promise.all(
    order.map((item) =>
      prisma.photo.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  )

  const galleryId = formData.get("galleryId") as string
  revalidatePath(`/admin/galleries/${galleryId}`)
}
