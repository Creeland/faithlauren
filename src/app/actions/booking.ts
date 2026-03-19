"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { verifyAdmin } from "@/lib/dal"

// Admin actions
export async function updateBookingStatus(formData: FormData) {
  await verifyAdmin()
  const id = formData.get("id") as string
  const status = formData.get("status") as string
  await prisma.booking.update({ where: { id }, data: { status } })
  revalidatePath("/admin/bookings")
  revalidatePath(`/admin/bookings/${id}`)
}

export async function deleteBooking(formData: FormData) {
  await verifyAdmin()
  const id = formData.get("id") as string
  await prisma.booking.delete({ where: { id } })
  redirect("/admin/bookings")
}

// Public booking form
const bookingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  sessionType: z.string().min(1, "Please select a session type"),
  date: z.string().optional(),
  message: z.string().optional(),
})

export type BookingState = {
  error?: string
  errors?: Record<string, string[]>
  success?: boolean
} | undefined

export async function createBooking(
  _prevState: BookingState,
  formData: FormData
): Promise<BookingState> {
  const parsed = bookingSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    sessionType: formData.get("sessionType"),
    date: formData.get("date"),
    message: formData.get("message"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  await prisma.booking.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      sessionType: parsed.data.sessionType,
      date: parsed.data.date || null,
      message: parsed.data.message || null,
    },
  })

  return { success: true }
}
