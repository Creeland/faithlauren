import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendBookingAlert, type BookingAlertInput } from "./alert";

// The booking-alert module has one external: an HTTP POST to TextBelt via the
// native `fetch`. These tests mock `fetch` and drive the two env vars that gate
// the send, pinning the contract the create-booking action relies on: skip when
// unconfigured, the right request payload when configured, and — above all —
// that the function never throws (it is fired-and-forgotten via `after()`).

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  delete process.env.TEXTBELT_API_KEY;
  delete process.env.BOOKING_ALERT_PHONE;
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

function configure() {
  process.env.TEXTBELT_API_KEY = "test-key";
  process.env.BOOKING_ALERT_PHONE = "+15551234567";
}

/** A complete, valid inquiry; override individual fields per test. */
function inquiry(overrides: Partial<BookingAlertInput> = {}): BookingAlertInput {
  return {
    name: "Ada Lovelace",
    sessionType: "Portrait",
    email: "ada@example.com",
    phone: "+15559876543",
    date: "2026-08-15",
    message: "Looking forward to it!",
    ...overrides,
  };
}

/**
 * Configure SMS, stub a successful fetch, send the alert, and return the SMS
 * body that was POSTed to TextBelt. The message body is entirely internal to the
 * module, so we assert on it through the transport rather than exporting it.
 */
async function sentBody(input: BookingAlertInput): Promise<string> {
  configure();
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true }),
  }));
  vi.stubGlobal("fetch", fetchMock);

  await sendBookingAlert(input);

  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(init.body as string).message as string;
}

describe("sendBookingAlert — skip when unconfigured", () => {
  it("does not call fetch and logs once when both env vars are unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(sendBookingAlert(inquiry())).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("skips when only the API key is set", async () => {
    process.env.TEXTBELT_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await sendBookingAlert(inquiry());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips when only the phone is set", async () => {
    process.env.BOOKING_ALERT_PHONE = "+15551234567";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await sendBookingAlert(inquiry());

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sendBookingAlert — request payload", () => {
  it("POSTs to TextBelt with the configured phone, key, and the inquirer's name", async () => {
    configure();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await sendBookingAlert(inquiry({ name: "Grace Hopper" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://textbelt.com/text");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.phone).toBe("+15551234567");
    expect(body.key).toBe("test-key");
    expect(body.message).toContain("Grace Hopper");
  });
});

describe("sendBookingAlert — message body", () => {
  it("includes name, session, date, phone, and email when all are present", async () => {
    const body = await sentBody(
      inquiry({
        name: "Grace Hopper",
        sessionType: "Wedding",
        date: "2026-09-01",
        phone: "+15551112222",
        email: "grace@example.com",
        message: "Can't wait!",
      }),
    );

    expect(body).toContain("Grace Hopper");
    expect(body).toContain("Wedding");
    expect(body).toContain("2026-09-01");
    expect(body).toContain("+15551112222");
    expect(body).toContain("grace@example.com");
    expect(body).toContain("Can't wait!");
  });

  it("never contains a URL", async () => {
    const body = await sentBody(inquiry());
    expect(body).not.toMatch(/https?:\/\//i);
    expect(body.toLowerCase()).not.toContain("textbelt.com");
  });
});

describe("sendBookingAlert — free-text truncation", () => {
  it("includes a short message whole, with no ellipsis", async () => {
    const message = "A".repeat(80);
    const body = await sentBody(inquiry({ message }));

    expect(body).toContain(message);
    expect(body).not.toContain("...");
  });

  it("includes a message at the 120-char limit whole, with no ellipsis", async () => {
    const message = "B".repeat(120);
    const body = await sentBody(inquiry({ message }));

    expect(body).toContain(message);
    expect(body).not.toContain("...");
  });

  it("truncates a message over the limit and appends an ellipsis", async () => {
    const message = "C".repeat(200);
    const body = await sentBody(inquiry({ message }));

    // First 120 chars kept, ellipsis appended, the 121st char onward dropped.
    expect(body).toContain("C".repeat(120) + "...");
    expect(body).not.toContain("C".repeat(121));
  });
});

describe("sendBookingAlert — optional fields", () => {
  it("omits date, phone, and message cleanly when absent", async () => {
    const body = await sentBody(
      inquiry({ date: null, phone: null, message: null }),
    );

    expect(body).not.toContain("Date:");
    expect(body).not.toContain("Phone:");
    // Required lines remain.
    expect(body).toContain("Ada Lovelace");
    expect(body).toContain("Session: Portrait");
    expect(body).toContain("Email: ada@example.com");
    // No dangling labels, separators, or blank lines.
    expect(body).not.toContain('""');
    expect(body).not.toMatch(/\n\n/);
    expect(body.endsWith("Email: ada@example.com")).toBe(true);
  });

  it("treats empty-string optionals the same as absent", async () => {
    const body = await sentBody(inquiry({ date: "", phone: "", message: "" }));

    expect(body).not.toContain("Date:");
    expect(body).not.toContain("Phone:");
    expect(body).not.toContain('""');
  });

  it("omits a whitespace-only message with no empty quotes", async () => {
    const body = await sentBody(inquiry({ message: "   \n  " }));
    expect(body).not.toContain('""');
    expect(body).not.toMatch(/"\s*"/);
  });

  it("includes date and phone lines only when present", async () => {
    const body = await sentBody(
      inquiry({ date: "2026-12-25", phone: null, message: null }),
    );

    expect(body).toContain("Date: 2026-12-25");
    expect(body).not.toContain("Phone:");
  });
});

describe("sendBookingAlert — total-length budget", () => {
  it("stays within two SMS segments with every field at maximum plausible length", async () => {
    const body = await sentBody(
      inquiry({
        name: "Alexandria Wilhelmina Featherstonehaugh-Montgomery",
        sessionType: "Lifestyle", // longest fixed-list value is short
        date: "2026-09-15",
        phone: "+1 (555) 123-4567 ext. 8901",
        email: "alexandria.featherstonehaugh@studio-example.com",
        message: "Z".repeat(500),
      }),
    );

    // Two concatenated GSM-7 segments carry 306 chars; the module caps at 300.
    expect(body.length).toBeLessThanOrEqual(300);
  });
});

describe("sendBookingAlert — never throws", () => {
  it("swallows a rejected fetch (network failure)", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed: ECONNRESET");
      }),
    );
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendBookingAlert(inquiry())).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
  });

  it("swallows a non-OK TextBelt response", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      })),
    );
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendBookingAlert(inquiry())).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
  });

  it("swallows a TextBelt success:false payload", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: false, error: "Out of quota" }),
      })),
    );
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendBookingAlert(inquiry())).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
  });
});
