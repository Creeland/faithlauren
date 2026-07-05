import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEED_EMAIL,
  DEFAULT_SEED_NAME,
  resolveSeedCredentials,
} from "./seed-credentials";

describe("resolveSeedCredentials", () => {
  it("uses the dev default password outside production", () => {
    const creds = resolveSeedCredentials({ NODE_ENV: "development" });
    expect(creds.password).toBe("admin123");
    expect(creds.email).toBe(DEFAULT_SEED_EMAIL);
    expect(creds.name).toBe(DEFAULT_SEED_NAME);
  });

  it("uses the dev default when NODE_ENV is unset (local seeding)", () => {
    const creds = resolveSeedCredentials({});
    expect(creds.password).toBe("admin123");
  });

  it("throws in production when SEED_ADMIN_PASSWORD is unset", () => {
    expect(() => resolveSeedCredentials({ NODE_ENV: "production" })).toThrow(
      /SEED_ADMIN_PASSWORD must be set/,
    );
  });

  it("throws in production when SEED_ADMIN_PASSWORD is blank/whitespace", () => {
    expect(() =>
      resolveSeedCredentials({
        NODE_ENV: "production",
        SEED_ADMIN_PASSWORD: "   ",
      }),
    ).toThrow(/SEED_ADMIN_PASSWORD must be set/);
  });

  it("never falls back to admin123 in production", () => {
    const creds = resolveSeedCredentials({
      NODE_ENV: "production",
      SEED_ADMIN_PASSWORD: "a-strong-production-secret",
    });
    expect(creds.password).toBe("a-strong-production-secret");
    expect(creds.password).not.toBe("admin123");
  });

  it("honors SEED_ADMIN_PASSWORD outside production too", () => {
    const creds = resolveSeedCredentials({
      NODE_ENV: "development",
      SEED_ADMIN_PASSWORD: "custom-dev-pw",
    });
    expect(creds.password).toBe("custom-dev-pw");
  });

  it("trims the env password", () => {
    const creds = resolveSeedCredentials({
      NODE_ENV: "production",
      SEED_ADMIN_PASSWORD: "  padded  ",
    });
    expect(creds.password).toBe("padded");
  });

  it("allows overriding email and name via env", () => {
    const creds = resolveSeedCredentials({
      NODE_ENV: "development",
      SEED_ADMIN_EMAIL: "admin@example.com",
      SEED_ADMIN_NAME: "Admin User",
    });
    expect(creds.email).toBe("admin@example.com");
    expect(creds.name).toBe("Admin User");
  });
});
