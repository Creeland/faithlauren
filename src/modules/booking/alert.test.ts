import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendBookingAlert } from "./alert";

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

describe("sendBookingAlert — skip when unconfigured", () => {
  it("does not call fetch and logs once when both env vars are unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(sendBookingAlert({ name: "Ada" })).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("skips when only the API key is set", async () => {
    process.env.TEXTBELT_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await sendBookingAlert({ name: "Ada" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips when only the phone is set", async () => {
    process.env.BOOKING_ALERT_PHONE = "+15551234567";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await sendBookingAlert({ name: "Ada" });

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

    await sendBookingAlert({ name: "Grace Hopper" });

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

    await expect(sendBookingAlert({ name: "Ada" })).resolves.toBeUndefined();
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

    await expect(sendBookingAlert({ name: "Ada" })).resolves.toBeUndefined();
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

    await expect(sendBookingAlert({ name: "Ada" })).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
  });
});
