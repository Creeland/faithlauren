import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import type { Gallery, Photo } from "@prisma/client"
import { verifyAdmin } from "@/lib/dal"
import { regeneratePassword } from "@/app/actions/gallery"
import { deletePhoto } from "@/app/actions/photo"
import { EditGalleryForm } from "./edit-form"
import { DeleteGalleryButton } from "./delete-gallery-button"
import { PhotoUploader } from "./photo-uploader"
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
      <div className="border border-stone-200 dark:border-stone-800 p-4 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-500 mb-1">Client Link & Password</p>
            <p className="text-sm">
              <CopyableUrl url={`${protocol}://${host}/gallery/${gallery.slug}`} />{" "}
              &middot; Password:{" "}
              <CopyableUrl url={gallery.password} />
            </p>
          </div>
          <form action={regeneratePassword}>
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
        <h2 className="text-lg font-light tracking-tight mb-4">
          Photos ({gallery.photos.length})
        </h2>

        <PhotoUploader galleryId={gallery.id} />

        {gallery.photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {gallery.photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <div className="aspect-square overflow-hidden bg-stone-100 dark:bg-stone-800">
                  <img
                    src={photo.url}
                    alt={photo.caption || photo.filename}
                    className="w-full h-full object-cover"
                  />
                </div>
                <form
                  action={deletePhoto}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
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
