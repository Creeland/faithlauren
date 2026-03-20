"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { verifyAdmin } from "@/lib/dal"
import { UTApi } from "uploadthing/server"

const utapi = new UTApi()

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

const portfolioSchema = z.object({
  title: z.string().min(1, "Title is required"),
})

export type PortfolioState = {
  error?: string
  errors?: Record<string, string[]>
} | undefined

export async function createPortfolio(
  _prevState: PortfolioState,
  formData: FormData
): Promise<PortfolioState> {
  await verifyAdmin()

  const parsed = portfolioSchema.safeParse({
    title: formData.get("title"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const slug = slugify(parsed.data.title)

  const existing = await prisma.portfolio.findUnique({ where: { slug } })
  if (existing) {
    return { error: "A portfolio with this name already exists" }
  }

  const maxSort = await prisma.portfolio.aggregate({
    _max: { sortOrder: true },
  })

  await prisma.portfolio.create({
    data: {
      title: parsed.data.title,
      slug,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  })

  redirect("/admin/portfolios")
}

export async function updatePortfolio(
  _prevState: PortfolioState,
  formData: FormData
): Promise<PortfolioState> {
  await verifyAdmin()

  const id = formData.get("id") as string
  const parsed = portfolioSchema.safeParse({
    title: formData.get("title"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  await prisma.portfolio.update({
    where: { id },
    data: {
      title: parsed.data.title,
    },
  })

  revalidatePath(`/admin/portfolios/${id}`)
  return undefined
}

export async function deletePortfolio(formData: FormData) {
  await verifyAdmin()
  const id = formData.get("id") as string

  const photos = await prisma.portfolioPhoto.findMany({
    where: { portfolioId: id },
    select: { fileKey: true },
  })
  const fileKeys = photos.map((p) => p.fileKey).filter(Boolean) as string[]
  if (fileKeys.length > 0) {
    await utapi.deleteFiles(fileKeys)
  }

  await prisma.portfolio.delete({ where: { id } })
  redirect("/admin/portfolios")
}

export async function setCoverPhoto(formData: FormData) {
  await verifyAdmin()
  const portfolioId = formData.get("portfolioId") as string
  const photoId = formData.get("photoId") as string
  const aspectRatio = formData.get("aspectRatio") as string | null

  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: {
      coverPhotoId: photoId,
      ...(aspectRatio && { aspectRatio }),
    },
  })

  revalidatePath(`/admin/portfolios/${portfolioId}`)
  revalidatePath("/")
}

export async function reorderPortfolios(formData: FormData) {
  await verifyAdmin()
  const order = JSON.parse(formData.get("order") as string) as {
    id: string
    sortOrder: number
  }[]

  await Promise.all(
    order.map((item) =>
      prisma.portfolio.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  )

  revalidatePath("/admin/portfolios")
}
