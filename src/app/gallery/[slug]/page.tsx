import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import type { Gallery, Photo } from "@prisma/client"
import Link from "next/link"
import { AlbumPasswordForm } from "./password-form"
import { GalleryClient } from "./gallery-client"

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const gallery: (Gallery & { photos: Photo[] }) | null = await prisma.gallery.findUnique({
    where: { slug },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  })

  if (!gallery) notFound()

  const cookieStore = await cookies()
  const accessCookie = cookieStore.get(`gallery-${slug}-access`)
  const hasAccess = accessCookie?.value === "granted"

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-light tracking-tight mb-2">
            {gallery.title}
          </h1>
          <p className="text-sm text-stone-500 mb-8">
            Enter the password to view this gallery.
          </p>
          <AlbumPasswordForm slug={slug} />
          <p className="mt-6">
            <a
              href="/"
              className="text-sm text-stone-500 hover:text-accent transition-colors"
            >
              &larr; Back to site
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg tracking-widest uppercase font-light"
          >
            Faith Lauren
          </Link>
          <h1 className="text-sm text-stone-500">{gallery.title}</h1>
        </div>
      </header>

      <GalleryClient
        slug={slug}
        title={gallery.title}
        description={gallery.description}
        photos={gallery.photos.map((p) => ({
          id: p.id,
          url: p.url,
          filename: p.filename,
          caption: p.caption,
          width: p.width,
          height: p.height,
        }))}
      />
    </div>
  )
}
