import "server-only";

/**
 * The booking module: inquiry creation (public contact form) and the admin
 * inquiry lifecycle (status, delete), plus the admin read views, behind one
 * interface. This index is the module's only import point — nothing outside the
 * module should reach into `./operations`, `./reads`, or `./alert`.
 *
 * The booking-alert (`./alert`) is itself a deep module nested here: its whole
 * surface is `sendBookingAlert`, which the create-booking action fires via
 * `after()` on the success path.
 */
export type { BookingInput } from "./operations";
export {
  createBooking,
  updateBookingStatus,
  deleteBooking,
} from "./operations";

export type { BookingSummary, BookingDetail } from "./reads";
export { listBookings, getBooking, countPendingBookings } from "./reads";

export type { BookingAlertInput } from "./alert";
export { sendBookingAlert } from "./alert";
