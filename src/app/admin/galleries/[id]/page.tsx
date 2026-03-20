import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import type { Gallery, Photo } from "@prisma/client"
import Image from "next/image"
import { verifyAdmin } from "@/lib/dal"
import { regeneratePassword } from "@/app/actions/gallery"
import { deletePhoto, deleteAllPhotos } from "@/app/actions/photo"
import { EditGalleryForm } from "./edit-form"
import { DeleteGalleryButton } from "./delete-gallery-button"
import { PhotoUploader } from "./photo-uploader"
import { DeleteAllPhotosButton } from "./delete-all-photos-button"
import { CopyableUrl } from "./copyable-url"

export default async function EditGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await verifyAdmin()
  const { id } = await params
  const headersList = await headers()
  const host = headersList.get("host") || "localhost:3000"
  const protocol = headersList.get("x-forwarded-proto") || "http"

  const gallery: (Gallery & { photos: Photo[] }) | null = await prisma.gallery.findUnique({
    where: { id },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  })

  if (!gallery) notFound()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light tracking-tight">{gallery.title}</h1>
        <DeleteGalleryButton galleryId={gallery.id} />
      </div>

      {/* Password section */}
      <div className="border border-stone-200 p-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-stone-500 mb-1">Client Link & Password</p>
            <div className="text-sm flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <CopyableUrl url={`${protocol}://${host}/gallery/${gallery.slug}`} />
              <span className="text-stone-400">&middot;</span>
              <span>Password:{" "}<CopyableUrl url={gallery.password} /></span>
            </div>
          </div>
          <form action={regeneratePassword} className="shrink-0">
            <input type="hidden" name="id" value={gallery.id} />
            <button
              type="submit"
              className="text-xs text-stone-500 hover:text-accent transition-colors"
            >
              Regenerate
            </button>
          </form>
        </div>
      </div>

      {/* Edit form */}
      <EditGalleryForm gallery={gallery} />

      {/* Photos */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-light tracking-tight">
            Photos ({gallery.photos.length})
          </h2>
          {gallery.photos.length > 0 && (
            <DeleteAllPhotosButton galleryId={gallery.id} />
          )}
        </div>

        <PhotoUploader galleryId={gallery.id} />

        {gallery.photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {gallery.photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <div className="relative aspect-square overflow-hidden bg-stone-100">
                  <Image
                    src={photo.url}
                    alt={photo.caption || photo.filename}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                    loading="lazy"
                  />
                </div>
                <form
                  action={deletePhoto}
                  className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                >
                  <input type="hidden" name="id" value={photo.id} />
                  <button
                    type="submit"
                    className="bg-red-600 text-white text-xs px-2 py-1 rounded"
                  >
                    &times;
                  </button>
                </form>
                <p className="text-xs text-stone-500 mt-1 truncate">
                  {photo.filename}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
