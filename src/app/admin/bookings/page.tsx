import { prisma } from "@/lib/prisma"
import { verifyAdmin } from "@/lib/dal"
import type { Booking } from "@prisma/client"
import Link from "next/link"

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await verifyAdmin()
  const { status } = await searchParams

  const where = status ? { status: status.toUpperCase() } : {}
  const bookings: Booking[] = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  const statusFilters = ["ALL", "PENDING", "APPROVED", "DECLINED"]

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-8">Bookings</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {statusFilters.map((s) => {
          const href =
            s === "ALL" ? "/admin/bookings" : `/admin/bookings?status=${s.toLowerCase()}`
          const isActive =
            s === "ALL" ? !status : status?.toUpperCase() === s
          return (
            <Link
              key={s}
              href={href}
              className={`text-xs px-3 py-1.5 border transition-colors ${
                isActive
                  ? "border-accent text-accent"
                  : "border-stone-200 dark:border-stone-800 text-stone-500 hover:border-accent hover:text-accent"
              }`}
            >
              {s[0] + s.slice(1).toLowerCase()}
            </Link>
          )
        })}
      </div>

      {bookings.length === 0 ? (
        <p className="text-stone-500 text-sm">No bookings found.</p>
      ) : (
        <div className="border border-stone-200 dark:border-stone-800 divide-y divide-stone-200 dark:divide-stone-800">
          {bookings.map((booking) => (
            <Link
              key={booking.id}
              href={`/admin/bookings/${booking.id}`}
              className="block p-4 hover:bg-accent-subtle transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{booking.name}</p>
                  <p className="text-xs text-stone-500 mt-0.5 truncate">
                    {booking.sessionType} &middot; {booking.email}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      booking.status === "PENDING"
                        ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                        : booking.status === "APPROVED"
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {booking.status}
                  </span>
                  <p className="text-xs text-stone-400 mt-1">
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
