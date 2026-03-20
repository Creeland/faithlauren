import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Image from "next/image"
import { verifyAdmin } from "@/lib/dal"
import { deletePortfolioPhoto } from "@/app/actions/portfolio-photo"
import { setCoverPhoto } from "@/app/actions/portfolio"
import { EditPortfolioForm } from "./edit-form"
import { DeletePortfolioButton } from "./delete-portfolio-button"
import { PortfolioPhotoUploader } from "./photo-uploader"
import { DeleteAllPortfolioPhotosButton } from "./delete-all-photos-button"

export default async function EditPortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await verifyAdmin()
  const { id } = await params

  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  })

  if (!portfolio) notFound()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light tracking-tight">{portfolio.title}</h1>
        <DeletePortfolioButton portfolioId={portfolio.id} />
      </div>

      {/* Edit form */}
      <EditPortfolioForm portfolio={portfolio} />

      {/* Photos */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-light tracking-tight">
            Photos ({portfolio.photos.length})
          </h2>
          {portfolio.photos.length > 0 && (
            <DeleteAllPortfolioPhotosButton portfolioId={portfolio.id} />
          )}
        </div>

        <PortfolioPhotoUploader portfolioId={portfolio.id} />

        {portfolio.photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {portfolio.photos.map((photo) => {
              const isCover = portfolio.coverPhotoId === photo.id

              return (
                <div key={photo.id} className="relative group">
                  <div className={`relative aspect-square overflow-hidden bg-stone-100 ${isCover ? "ring-2 ring-accent" : ""}`}>
                    <Image
                      src={photo.url}
                      alt={photo.filename}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="absolute top-1 right-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <form action={deletePortfolioPhoto}>
                      <input type="hidden" name="id" value={photo.id} />
                      <button
                        type="submit"
                        className="bg-red-600 text-white text-xs px-2 py-1 rounded"
                      >
                        &times;
                      </button>
                    </form>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-1">
                    <p className="text-xs text-stone-500 truncate">
                      {photo.filename}
                    </p>
                    {isCover ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-accent font-medium">
                          Cover
                        </span>
                        <form action={setCoverPhoto} className="flex items-center gap-1">
                          <input type="hidden" name="portfolioId" value={portfolio.id} />
                          <input type="hidden" name="photoId" value={photo.id} />
                          <select
                            name="aspectRatio"
                            defaultValue={portfolio.aspectRatio}
                            className="text-xs border border-stone-300 bg-background px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent"
                          >
                            <option value="aspect-3/4">3:4</option>
                            <option value="aspect-2/3">2:3</option>
                            <option value="aspect-4/5">4:5</option>
                          </select>
                          <button
                            type="submit"
                            className="text-xs text-stone-400 hover:text-accent transition-colors"
                          >
                            Update
                          </button>
                        </form>
                      </div>
                    ) : (
                      <form action={setCoverPhoto} className="flex items-center gap-1 shrink-0">
                        <input type="hidden" name="portfolioId" value={portfolio.id} />
                        <input type="hidden" name="photoId" value={photo.id} />
                        <select
                          name="aspectRatio"
                          defaultValue={portfolio.aspectRatio}
                          className="text-xs border border-stone-300 bg-background px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent"
                        >
                          <option value="aspect-3/4">3:4</option>
                          <option value="aspect-2/3">2:3</option>
                          <option value="aspect-4/5">4:5</option>
                        </select>
                        <button
                          type="submit"
                          className="text-xs text-stone-400 hover:text-accent transition-colors"
                        >
                          Set Cover
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
