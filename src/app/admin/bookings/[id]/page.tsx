import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import type { Booking } from "@prisma/client"
import { verifyAdmin } from "@/lib/dal"
import { updateBookingStatus, deleteBooking } from "@/app/actions/booking"
import Link from "next/link"

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await verifyAdmin()
  const { id } = await params

  const booking: Booking | null = await prisma.booking.findUnique({ where: { id } })
  if (!booking) notFound()

  return (
    <div className="max-w-lg">
      <Link
        href="/admin/bookings"
        className="text-sm text-stone-500 hover:text-accent transition-colors"
      >
        &larr; All bookings
      </Link>

      <h1 className="text-2xl font-light tracking-tight mt-4 mb-6">
        {booking.name}
      </h1>

      <div className="space-y-3 text-sm mb-8">
        <div className="flex justify-between gap-4 border-b border-stone-100 pb-2">
          <span className="text-stone-500 shrink-0">Email</span>
          <span className="truncate">{booking.email}</span>
        </div>
        {booking.phone && (
          <div className="flex justify-between border-b border-stone-100 pb-2">
            <span className="text-stone-500">Phone</span>
            <span>{booking.phone}</span>
          </div>
        )}
        <div className="flex justify-between border-b border-stone-100 pb-2">
          <span className="text-stone-500">Session type</span>
          <span>{booking.sessionType}</span>
        </div>
        {booking.date && (
          <div className="flex justify-between border-b border-stone-100 pb-2">
            <span className="text-stone-500">Preferred date</span>
            <span>{booking.date}</span>
          </div>
        )}
        <div className="flex justify-between border-b border-stone-100 pb-2">
          <span className="text-stone-500">Status</span>
          <span
            className={`px-2 py-0.5 rounded text-xs ${
              booking.status === "PENDING"
                ? "bg-yellow-100 text-yellow-700"
                : booking.status === "APPROVED"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {booking.status}
          </span>
        </div>
        {booking.message && (
          <div className="border-b border-stone-100 pb-2">
            <p className="text-stone-500 mb-1">Message</p>
            <p className="whitespace-pre-wrap">{booking.message}</p>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-stone-500">Submitted</span>
          <span>{new Date(booking.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {booking.status !== "APPROVED" && (
          <form action={updateBookingStatus}>
            <input type="hidden" name="id" value={booking.id} />
            <input type="hidden" name="status" value="APPROVED" />
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 transition-colors"
            >
              Approve
            </button>
          </form>
        )}
        {booking.status !== "DECLINED" && (
          <form action={updateBookingStatus}>
            <input type="hidden" name="id" value={booking.id} />
            <input type="hidden" name="status" value="DECLINED" />
            <button
              type="submit"
              className="bg-stone-600 text-white px-4 py-2 text-sm hover:bg-stone-700 transition-colors"
            >
              Decline
            </button>
          </form>
        )}
        <form action={deleteBooking}>
          <input type="hidden" name="id" value={booking.id} />
          <button
            type="submit"
            className="text-sm text-red-600 px-4 py-2 hover:text-red-700 transition-colors"
          >
            Delete
          </button>
        </form>
      </div>
    </div>
  )
}
