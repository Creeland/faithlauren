import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockAfter, mockBookingModule, mockVerifyToken } =
  vi.hoisted(() => ({
    mockRedirect: vi.fn((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    }),
    mockAfter: vi.fn(),
    mockVerifyToken: vi.fn(),
    mockBookingModule: {
      createBooking: vi.fn(),
      sendBookingAlert: vi.fn(),
    },
  }));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("next/server", () => ({ after: mockAfter }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: mockVerifyToken }));
vi.mock("@/modules/booking", () => mockBookingModule);
vi.mock("@/modules/shared/admin-action", () => ({
  adminAction: () => vi.fn(),
}));

import { createBooking } from "./booking";

// Mirrors a real browser submit: every rendered field is present, optional
// ones as empty strings (the schema rejects null, so absence would 400).
function validForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("name", "Jane Doe");
  fd.set("email", "jane@example.com");
  fd.set("phone", "");
  fd.set("sessionType", "Portrait");
  fd.set("date", "");
  fd.set("message", "");
  fd.set("cf-turnstile-response", "token-123");
  for (const [key, value] of Object.entries(overrides)) {
    fd.set(key, value);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyToken.mockResolvedValue(true);
});

describe("createBooking", () => {
  it("creates the booking and redirects to /thank-you", async () => {
    await expect(createBooking(undefined, validForm())).rejects.toThrow(
      "NEXT_REDIRECT:/thank-you",
    );

    expect(mockBookingModule.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jane Doe", sessionType: "Portrait" }),
    );
    expect(mockAfter).toHaveBeenCalledOnce();
  });

  it("redirects a honeypot submission to /thank-you without creating anything", async () => {
    const fd = validForm({ _hp_name: "I am a bot" });

    await expect(createBooking(undefined, fd)).rejects.toThrow(
      "NEXT_REDIRECT:/thank-you",
    );

    expect(mockBookingModule.createBooking).not.toHaveBeenCalled();
    expect(mockAfter).not.toHaveBeenCalled();
  });

  it("returns an error state without redirecting when the captcha token is missing", async () => {
    const fd = validForm();
    fd.delete("cf-turnstile-response");

    const state = await createBooking(undefined, fd);

    expect(state?.error).toMatch(/verification/i);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockBookingModule.createBooking).not.toHaveBeenCalled();
  });

  it("returns field errors without redirecting for invalid input", async () => {
    const fd = validForm({ email: "not-an-email" });

    const state = await createBooking(undefined, fd);

    expect(state?.errors?.email).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockBookingModule.createBooking).not.toHaveBeenCalled();
  });
});
