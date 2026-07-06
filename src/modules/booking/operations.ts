import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * The write side of the booking module: create an inquiry (from the public
 * contact form) and the two admin lifecycle mutations (status change, delete).
 * This is thin CRUD — no business rules beyond null-normalizing optional fields
 * — so the action layer above only parses form input and enforces the public
 * boundary checks (honeypot, Turnstile). Each admin mutation revalidates the
 * admin views it affects, so callers never have to remember to.
 */

/** A contact-form inquiry, already validated into typed fields by the action. */
export interface BookingInput {
  name: string;
  email: string;
  phone?: string | null;
  sessionType: string;
  date?: string | null;
  message?: string | null;
}

/**
 * Record a new inquiry from the public contact form. Optional fields collapse
 * empty values to null (matching the stored shape today). Status defaults to
 * PENDING at the schema level. The public form shows its own success state, so
 * there is nothing to revalidate here.
 */
export async function createBooking(input: BookingInput): Promise<void> {
  await prisma.booking.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      sessionType: input.sessionType,
      date: input.date || null,
      message: input.message || null,
    },
  });
}

/**
 * Move an inquiry to a new status (e.g. APPROVED / DECLINED). Revalidates the
 * admin list and the inquiry's detail page so the new status shows immediately.
 */
export async function updateBookingStatus(
  id: string,
  status: string,
): Promise<void> {
  await prisma.booking.update({ where: { id }, data: { status } });
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
}

/**
 * Delete an inquiry. Revalidates the admin list; the calling action redirects
 * back to it.
 */
export async function deleteBooking(id: string): Promise<void> {
  await prisma.booking.delete({ where: { id } });
  revalidatePath("/admin/bookings");
}
