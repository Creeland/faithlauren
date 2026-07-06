import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * The read side of the booking module: the two queries behind the admin
 * bookings pages. Each returns a module-owned view type — a plain shape mapped
 * from the Prisma row — so the pages never see a Prisma-generated `Booking`
 * type. Inquiries are always listed newest-first; that ordering invariant lives
 * here and only here.
 */
const byNewest = { createdAt: "desc" } as const;

/** A booking as the admin list row renders it. */
export interface BookingSummary {
  id: string;
  name: string;
  email: string;
  sessionType: string;
  status: string;
  createdAt: Date;
}

/** A booking as its admin detail page renders it. */
export interface BookingDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  sessionType: string;
  date: string | null;
  status: string;
  message: string | null;
  createdAt: Date;
}

/**
 * All inquiries newest-first, optionally filtered to a single status. The
 * status is matched case-insensitively (uppercased), owning the filter that the
 * list page's tab UI used to spell out.
 */
export async function listBookings(
  status?: string,
): Promise<BookingSummary[]> {
  const where = status ? { status: status.toUpperCase() } : {};
  return prisma.booking.findMany({
    where,
    orderBy: byNewest,
    select: {
      id: true,
      name: true,
      email: true,
      sessionType: true,
      status: true,
      createdAt: true,
    },
  });
}

/** How many inquiries are still pending (dashboard count). */
export function countPendingBookings(): Promise<number> {
  return prisma.booking.count({ where: { status: "PENDING" } });
}

/** A single inquiry by id, or `null` if no such inquiry exists. */
export async function getBooking(id: string): Promise<BookingDetail | null> {
  return prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      sessionType: true,
      date: true,
      status: true,
      message: true,
      createdAt: true,
    },
  });
}
