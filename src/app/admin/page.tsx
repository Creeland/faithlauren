import { verifyAdmin } from "@/lib/dal"
import { countGalleries, countGalleryPhotos } from "@/modules/gallery"
import { countPortfolios } from "@/modules/portfolio"
import { countPendingBookings } from "@/modules/booking"
import Link from "next/link"

export default async function AdminDashboard() {
  await verifyAdmin()

  const [galleryCount, photoCount, portfolioCount, pendingBookings] = await Promise.all([
    countGalleries(),
    countGalleryPhotos(),
    countPortfolios(),
    countPendingBookings(),
  ])

  const cards = [
    {
      label: "Galleries",
      count: galleryCount,
      href: "/admin/galleries",
    },
    {
      label: "Photos",
      count: photoCount,
      href: "/admin/galleries",
    },
    {
      label: "Portfolios",
      count: portfolioCount,
      href: "/admin/portfolios",
    },
    {
      label: "Pending Bookings",
      count: pendingBookings,
      href: "/admin/bookings",
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="border border-stone-200 p-6 hover:border-accent transition-colors"
          >
            <p className="text-3xl font-light mb-1">{card.count}</p>
            <p className="text-sm text-stone-500">{card.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
