"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { adminAction } from "@/modules/shared/admin-action";
import * as bookingModule from "@/modules/booking";

// Admin actions — thin shells over the module. adminAction verifies the caller
// and parses the form; the module does the mutation and its revalidation.
export const updateBookingStatus = adminAction(
  z.object({ id: z.string(), status: z.string() }),
  ({ id, status }) => bookingModule.updateBookingStatus(id, status),
);

export const deleteBooking = adminAction(
  z.object({ id: z.string() }),
  async ({ id }) => {
    await bookingModule.deleteBooking(id);
    // redirect throws NEXT_REDIRECT; keep it after the module call so the
    // deletion has committed before we navigate back to the list.
    redirect("/admin/bookings");
  },
);

// Public booking form
const bookingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  sessionType: z.string().min(1, "Please select a session type"),
  date: z.string().optional(),
  message: z.string().optional(),
});

export type BookingState =
  | {
      error?: string;
      errors?: Record<string, string[]>;
      success?: boolean;
    }
  | undefined;

export async function createBooking(
  _prevState: BookingState,
  formData: FormData,
): Promise<BookingState> {
  // Honeypot — if filled, a bot submitted this. Return fake success.
  if (formData.get("_hp_name")) {
    return { success: true };
  }

  // Turnstile CAPTCHA verification stays at the public boundary.
  const turnstileToken = formData.get("cf-turnstile-response") as string;
  if (!turnstileToken) {
    return { error: "Please complete the verification check." };
  }
  const tokenValid = await verifyTurnstileToken(turnstileToken);
  if (!tokenValid) {
    return { error: "Verification failed. Please try again." };
  }

  const parsed = bookingSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    sessionType: formData.get("sessionType"),
    date: formData.get("date"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await bookingModule.createBooking(parsed.data);

  return { success: true };
}
