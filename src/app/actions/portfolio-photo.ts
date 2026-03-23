"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { verifyAdmin } from "@/lib/dal"
import { UTApi } from "uploadthing/server"

const utapi = new UTApi()

export async function deletePortfolioPhoto(formData: FormData) {
  await verifyAdmin()
  const id = formData.get("id") as string
  const photo = await prisma.portfolioPhoto.findUnique({ where: { id } })

  if (photo) {
    if (photo.fileKey) {
      await utapi.deleteFiles(photo.fileKey)
    }

    // Null out coverPhotoId if this was the cover
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: photo.portfolioId },
    })
    if (portfolio?.coverPhotoId === id) {
      await prisma.portfolio.update({
        where: { id: photo.portfolioId },
        data: { coverPhotoId: null },
      })
    }

    await prisma.portfolioPhoto.delete({ where: { id } })
    revalidatePath(`/admin/portfolios/${photo.portfolioId}`)
  }
}

export async function deleteAllPortfolioPhotos(formData: FormData) {
  await verifyAdmin()
  const portfolioId = formData.get("portfolioId") as string

  const photos = await prisma.portfolioPhoto.findMany({
    where: { portfolioId },
    select: { fileKey: true },
  })

  const fileKeys = photos.map((p) => p.fileKey).filter(Boolean) as string[]
  if (fileKeys.length > 0) {
    await utapi.deleteFiles(fileKeys)
  }

  await prisma.portfolioPhoto.deleteMany({ where: { portfolioId } })
  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: { coverPhotoId: null },
  })

  revalidatePath(`/admin/portfolios/${portfolioId}`)
}

export async function getPortfolioPhotoCount(portfolioId: string): Promise<number> {
  await verifyAdmin()
  return prisma.portfolioPhoto.count({ where: { portfolioId } })
}

export async function reorderPortfolioPhotos(formData: FormData) {
  await verifyAdmin()
  const order = JSON.parse(formData.get("order") as string) as {
    id: string
    sortOrder: number
  }[]

  await prisma.$transaction(
    order.map((item) =>
      prisma.portfolioPhoto.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  )

  const portfolioId = formData.get("portfolioId") as string
  revalidatePath(`/admin/portfolios/${portfolioId}`)
}
