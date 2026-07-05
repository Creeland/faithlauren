import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, clearRateLimits } from "./rate-limit";

const WINDOW = 60_000;

describe("checkRateLimit", () => {
  beforeEach(() => {
    clearRateLimits();
  });

  it("allows attempts up to the limit within a window", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("key", 5, WINDOW, 1000)).toEqual({ ok: true });
    }
  });

  it("rejects the attempt after the limit with time until reset", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("key", 5, WINDOW, 1000);
    }
    expect(checkRateLimit("key", 5, WINDOW, 21_000)).toEqual({
      ok: false,
      retryAfterMs: 1000 + WINDOW - 21_000,
    });
  });

  it("allows attempts again once the window has passed", () => {
    for (let i = 0; i < 6; i++) {
      checkRateLimit("key", 5, WINDOW, 1000);
    }
    expect(checkRateLimit("key", 5, WINDOW, 1000 + WINDOW)).toEqual({
      ok: true,
    });
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("key-a", 5, WINDOW, 1000);
    }
    expect(checkRateLimit("key-a", 5, WINDOW, 1000).ok).toBe(false);
    expect(checkRateLimit("key-b", 5, WINDOW, 1000).ok).toBe(true);
  });

  it("keeps rejecting for the whole window, not just the next call", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("key", 5, WINDOW, 1000);
    }
    expect(checkRateLimit("key", 5, WINDOW, 30_000).ok).toBe(false);
    expect(checkRateLimit("key", 5, WINDOW, WINDOW).ok).toBe(false);
    expect(checkRateLimit("key", 5, WINDOW, 1000 + WINDOW).ok).toBe(true);
  });
});
