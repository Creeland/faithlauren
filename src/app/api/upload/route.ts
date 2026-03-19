import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const files = formData.getAll("files") as File[]
  const galleryId = formData.get("galleryId") as string

  if (!galleryId || files.length === 0) {
    return NextResponse.json({ error: "Missing files or gallery ID" }, { status: 400 })
  }

  const gallery = await prisma.gallery.findUnique({ where: { id: galleryId } })
  if (!gallery) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 })
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", gallery.slug)
  await mkdir(uploadDir, { recursive: true })

  const currentMax = await prisma.photo.aggregate({
    where: { galleryId },
    _max: { sortOrder: true },
  })
  let sortOrder = (currentMax._max.sortOrder ?? -1) + 1

  const uploaded = []

  for (const file of files) {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const ext = path.extname(file.name) || ".jpg"
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
    const filepath = path.join(uploadDir, filename)

    await writeFile(filepath, buffer)

    const photo = await prisma.photo.create({
      data: {
        url: `/uploads/${gallery.slug}/${filename}`,
        filename: file.name,
        galleryId,
        sortOrder: sortOrder++,
      },
    })

    uploaded.push(photo)
  }

  return NextResponse.json({ photos: uploaded })
}
