import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import archiver from "archiver"
import { PassThrough } from "stream"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const cookieStore = await cookies()
  const accessCookie = cookieStore.get(`gallery-${slug}-access`)
  if (accessCookie?.value !== "granted") {
    return new Response("Unauthorized", { status: 401 })
  }

  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  })

  if (!gallery) {
    return new Response("Not found", { status: 404 })
  }

  if (gallery.photos.length === 0) {
    return new Response("No photos in this gallery", { status: 404 })
  }

  const passthrough = new PassThrough()
  const archive = archiver("zip", { zlib: { level: 5 } })

  archive.pipe(passthrough)

  for (const photo of gallery.photos) {
    const response = await fetch(photo.url)
    if (!response.ok) continue
    const buffer = Buffer.from(await response.arrayBuffer())
    archive.append(buffer, { name: photo.filename })
  }

  archive.finalize()

  const stream = new ReadableStream({
    start(controller) {
      passthrough.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk))
      })
      passthrough.on("end", () => {
        controller.close()
      })
      passthrough.on("error", (err) => {
        controller.error(err)
      })
    },
  })

  const safeFilename = gallery.title.replace(/[^a-zA-Z0-9 _-]/g, "").trim()

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeFilename}.zip"`,
    },
  })
}
