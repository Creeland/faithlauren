"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { verifyAdmin } from "@/lib/dal"

function generatePassword() {
  return crypto.randomBytes(4).toString("hex")
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

const gallerySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
})

export type GalleryState = {
  error?: string
  errors?: Record<string, string[]>
} | undefined

export async function createGallery(
  _prevState: GalleryState,
  formData: FormData
): Promise<GalleryState> {
  await verifyAdmin()

  const parsed = gallerySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const slug = slugify(parsed.data.title)

  const existing = await prisma.gallery.findUnique({ where: { slug } })
  if (existing) {
    return { error: "A gallery with this name already exists" }
  }

  await prisma.gallery.create({
    data: {
      title: parsed.data.title,
      slug,
      description: parsed.data.description || null,
      password: generatePassword(),
    },
  })

  redirect("/admin/galleries")
}

export async function updateGallery(
  _prevState: GalleryState,
  formData: FormData
): Promise<GalleryState> {
  await verifyAdmin()

  const id = formData.get("id") as string
  const parsed = gallerySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  await prisma.gallery.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
    },
  })

  revalidatePath(`/admin/galleries/${id}`)
  return undefined
}

export async function deleteGallery(formData: FormData) {
  await verifyAdmin()
  const id = formData.get("id") as string
  await prisma.gallery.delete({ where: { id } })
  redirect("/admin/galleries")
}

export async function regeneratePassword(formData: FormData) {
  await verifyAdmin()
  const id = formData.get("id") as string
  await prisma.gallery.update({
    where: { id },
    data: { password: generatePassword() },
  })
  revalidatePath(`/admin/galleries/${id}`)
}

// Public action for album password verification
export type AlbumPasswordState = {
  error?: string
} | undefined

export async function verifyAlbumPassword(
  _prevState: AlbumPasswordState,
  formData: FormData
): Promise<AlbumPasswordState> {
  const slug = formData.get("slug") as string
  const password = formData.get("password") as string

  const gallery = await prisma.gallery.findUnique({ where: { slug } })

  if (!gallery || gallery.password !== password) {
    return { error: "Incorrect password" }
  }

  const cookieStore = await cookies()
  cookieStore.set(`gallery-${slug}-access`, "granted", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: `/gallery/${slug}`,
  })

  revalidatePath(`/gallery/${slug}`)
  return undefined
}
