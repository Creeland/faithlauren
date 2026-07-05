// Resolves the admin credentials used by prisma/seed.ts.
//
// The historical default password ("admin123") is convenient for local
// development but must never reach production. In production the password
// MUST come from SEED_ADMIN_PASSWORD and seeding fails loudly if it is
// unset, so the default can only ever be used locally.

export const DEFAULT_SEED_EMAIL = "faith@provinsal.com";
export const DEFAULT_SEED_NAME = "Faith Lauren";
const DEFAULT_DEV_PASSWORD = "admin123";

export type SeedCredentials = {
  email: string;
  name: string;
  password: string;
};

export function resolveSeedCredentials(
  env: NodeJS.ProcessEnv = process.env,
): SeedCredentials {
  const isProduction = env.NODE_ENV === "production";
  const passwordFromEnv = env.SEED_ADMIN_PASSWORD?.trim();

  if (isProduction && !passwordFromEnv) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must be set when seeding in production. " +
        "Refusing to seed the default development password. " +
        "Set SEED_ADMIN_PASSWORD to a strong secret (and rotate it after first login).",
    );
  }

  return {
    email: env.SEED_ADMIN_EMAIL?.trim() || DEFAULT_SEED_EMAIL,
    name: env.SEED_ADMIN_NAME?.trim() || DEFAULT_SEED_NAME,
    password: passwordFromEnv || DEFAULT_DEV_PASSWORD,
  };
}
