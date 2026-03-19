import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import type { Gallery, Photo } from "@prisma/client"
import { AlbumPasswordForm } from "./password-form"

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
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a
            href="/"
            className="text-lg tracking-widest uppercase font-light"
          >
            Faith Lauren
          </a>
          <h1 className="text-sm text-stone-500">{gallery.title}</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {gallery.description && (
          <p className="text-stone-600 dark:text-stone-400 mb-8 max-w-lg">
            {gallery.description}
          </p>
        )}

        {gallery.photos.length > 0 && (
          <div className="mb-8">
            <a
              href={`/api/gallery/${slug}/download`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download All
            </a>
          </div>
        )}

        {gallery.photos.length === 0 ? (
          <p className="text-stone-500 text-sm">
            No photos in this gallery yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {gallery.photos.map((photo) => (
              <div
                key={photo.id}
                className="aspect-[3/4] overflow-hidden bg-stone-100 dark:bg-stone-800"
              >
                <img
                  src={photo.url}
                  alt={photo.caption || photo.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
