import "server-only";

/**
 * The booking-alert module: a deep module whose entire surface is the single
 * function {@link sendBookingAlert}. Everything else — reading the SMS config
 * from the environment, the TextBelt HTTP transport, and the promise that this
 * side effect never throws — is hidden behind that one call.
 *
 * The contract is deliberately narrow so callers can fire-and-forget it (via
 * Next.js `after()`) on the create-booking success path without ever having to
 * think about config, transport, or failure. A booking must be recorded whether
 * or not the owner's phone is notified, so this function:
 *
 *   - skips silently (one log line) when SMS is not configured, and
 *   - swallows every failure (network rejection or non-OK response) with a log,
 *
 * i.e. it always resolves and never rejects. The rich message body arrives in a
 * follow-up slice; this slice sends only the inquirer's name.
 */

const TEXTBELT_SEND_URL = "https://textbelt.com/text";

/** The data an alert needs. Minimal for now — grows with the message body. */
export interface BookingAlertInput {
  /** The inquirer's name, as submitted on the public contact form. */
  name: string;
}

/**
 * Notify the site owner of a new booking inquiry by SMS.
 *
 * Reads `TEXTBELT_API_KEY` and `BOOKING_ALERT_PHONE` from the environment; if
 * either is missing, SMS is considered unconfigured and the call skips with a
 * single log line (no network access). When both are present, it POSTs the
 * message to TextBelt. Any failure — a rejected `fetch` (DNS/reset/TLS/timeout),
 * a non-OK HTTP status, or a TextBelt `success: false` payload — is logged and
 * swallowed. The returned promise always resolves; it never rejects.
 */
export async function sendBookingAlert(
  input: BookingAlertInput,
): Promise<void> {
  const apiKey = process.env.TEXTBELT_API_KEY;
  const phone = process.env.BOOKING_ALERT_PHONE;

  if (!apiKey || !phone) {
    console.log(
      "[booking-alert] SMS not configured (TEXTBELT_API_KEY and/or " +
        "BOOKING_ALERT_PHONE unset); skipping alert.",
    );
    return;
  }

  const message = `New booking inquiry: ${input.name}`;

  try {
    const response = await fetch(TEXTBELT_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, key: apiKey }),
    });

    if (!response.ok) {
      console.error(
        `[booking-alert] TextBelt responded ${response.status}; alert not sent.`,
      );
      return;
    }

    const data = (await response.json()) as { success?: boolean; error?: string };
    if (!data.success) {
      console.error(
        `[booking-alert] TextBelt rejected the send: ${data.error ?? "unknown error"}.`,
      );
    }
  } catch (error) {
    // Network-level failure (fetch rejected) or a body that would not parse.
    // Swallow it — the booking is already committed and must not be undone by
    // a failed notification.
    console.error("[booking-alert] failed to send SMS alert:", error);
  }
}
