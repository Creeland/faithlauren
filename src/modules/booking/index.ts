import "server-only";

/**
 * The booking module: inquiry creation (public contact form) and the admin
 * inquiry lifecycle (status, delete), plus the admin read views, behind one
 * interface. This index is the module's only import point — nothing outside the
 * module should reach into `./operations` or `./reads`.
 */
export type { BookingInput } from "./operations";
export {
  createBooking,
  updateBookingStatus,
  deleteBooking,
} from "./operations";

export type { BookingSummary, BookingDetail } from "./reads";
export { listBookings, getBooking } from "./reads";
