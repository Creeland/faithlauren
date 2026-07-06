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
 * i.e. it always resolves and never rejects.
 *
 * The body is the full inquiry — name, session type, requested date, phone, and
 * email, plus the free-text message truncated to keep the whole SMS within two
 * segments — so the owner can triage urgency and reply directly without opening
 * the admin screen. See {@link formatAlertMessage} for the exact shape.
 */

const TEXTBELT_SEND_URL = "https://textbelt.com/text";

/**
 * The free-text message is trimmed to this many characters (an ellipsis is then
 * appended) so a long inquiry can't blow the two-segment budget on its own.
 */
const MESSAGE_MAX = 120;

/**
 * A hard ceiling on the whole body. A concatenated GSM-7 SMS carries 153
 * characters per segment, so two segments hold 306; we stay under that. Only
 * `message` (last in the body) can realistically push the total this far — the
 * other fields are short and bounded — so a tail trim here only ever shortens
 * the already-truncated message, never the phone/email the owner needs to reply.
 */
const BODY_MAX = 300;

/**
 * Plain ASCII ellipsis. A single "…" (U+2026) is outside the GSM-7 alphabet and
 * would force the whole message into UCS-2 (67 chars/segment), halving the
 * budget — so we spell it out.
 */
const ELLIPSIS = "...";

/** The full inquiry an alert renders, as validated by the create-booking action. */
export interface BookingAlertInput {
  /** The inquirer's name, as submitted on the public contact form. */
  name: string;
  /** The session type chosen on the form (a short, fixed-list value). */
  sessionType: string;
  /** The reply-to email address. Always present (required by the form). */
  email: string;
  /** Requested date, if given. Omitted from the body when absent. */
  date?: string | null;
  /** Contact phone, if given. Omitted from the body when absent. */
  phone?: string | null;
  /** Free-text message, if given. Truncated, then omitted when absent/blank. */
  message?: string | null;
}

/** Trim `text` to `max` chars, appending an ellipsis only when it was longer. */
function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max).trimEnd() + ELLIPSIS;
}

/**
 * Render the SMS body from an inquiry.
 *
 * Required lines (name, session, email) always appear; optional lines (date,
 * phone, message) are pushed only when present, so an absent field leaves no
 * dangling label, separator, or blank line. The message is truncated to
 * {@link MESSAGE_MAX} and quoted; the whole body is then capped at
 * {@link BODY_MAX} as a final guard against an unexpectedly long field. No URL
 * is ever added — the owner replies to the phone/email, not a link.
 */
function formatAlertMessage(input: BookingAlertInput): string {
  const lines = [
    `New booking inquiry: ${input.name}`,
    `Session: ${input.sessionType}`,
  ];

  if (input.date) {
    lines.push(`Date: ${input.date}`);
  }
  if (input.phone) {
    lines.push(`Phone: ${input.phone}`);
  }

  lines.push(`Email: ${input.email}`);

  const message = input.message?.trim();
  if (message) {
    lines.push(`"${truncate(message, MESSAGE_MAX)}"`);
  }

  const body = lines.join("\n");
  if (body.length <= BODY_MAX) {
    return body;
  }
  return body.slice(0, BODY_MAX - ELLIPSIS.length).trimEnd() + ELLIPSIS;
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

  const message = formatAlertMessage(input);

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
