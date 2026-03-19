"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { verifyAdmin } from "@/lib/dal"

export async function deletePhoto(formData: FormData) {
  await verifyAdmin()
  const id = formData.get("id") as string
  const photo = await prisma.photo.findUnique({ where: { id } })

  if (photo) {
    await prisma.photo.delete({ where: { id } })
    revalidatePath(`/admin/galleries/${photo.galleryId}`)
  }
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
