import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { verifyAdmin } from "@/lib/dal"
import { EditPortfolioForm } from "./edit-form"
import { DeletePortfolioButton } from "./delete-portfolio-button"
import { PortfolioPhotoUploader } from "./photo-uploader"
import { DeleteAllPortfolioPhotosButton } from "./delete-all-photos-button"
import { PortfolioPhotoGrid } from "./photo-grid"

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
          <div className="mt-4">
            <PortfolioPhotoGrid
              photos={portfolio.photos}
              portfolioId={portfolio.id}
              coverPhotoId={portfolio.coverPhotoId}
              aspectRatio={portfolio.aspectRatio}
            />
          </div>
        )}
      </div>
    </div>
  )
}
