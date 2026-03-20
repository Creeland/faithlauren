import { prisma } from "@/lib/prisma"
import { verifyAdmin } from "@/lib/dal"
import Link from "next/link"

export default async function AdminDashboard() {
  await verifyAdmin()

  const [galleryCount, photoCount, pendingBookings] = await Promise.all([
    prisma.gallery.count(),
    prisma.photo.count(),
    prisma.booking.count({ where: { status: "PENDING" } }),
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
      label: "Pending Bookings",
      count: pendingBookings,
      href: "/admin/bookings",
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
