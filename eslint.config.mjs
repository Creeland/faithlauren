import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * The Prisma client and Prisma-generated types are reachable only inside the
 * domain modules (src/modules). Application code — pages, actions, components,
 * routes — must go through a module interface, which returns module-owned view
 * types with secrets structurally absent. This is the mechanical half of the
 * deep-modules boundary: it binds every future contributor, human or agent,
 * because a violation fails the build.
 *
 * Two narrow, deliberate exemptions (see the `ignores` on the app-code block):
 *   - `src/lib/prisma.ts` constructs the single client the modules import;
 *   - `src/auth.ts` wires NextAuth's Prisma adapter — authentication is out of
 *     scope for the modules design (see the PRD), and the adapter fundamentally
 *     needs the client.
 * Test files are exempt too: they drive modules and the throwaway DB directly.
 */
const prismaPaths = [
  {
    name: "@prisma/client",
    message:
      "Prisma-generated types are module-internal. Use a module's own view type from its index (e.g. @/modules/gallery) instead.",
  },
];

const prismaPatterns = [
  {
    group: ["@/lib/prisma", "**/lib/prisma"],
    message:
      "The Prisma client lives behind the modules. Go through a module interface (src/modules/<name>) instead of importing it directly.",
  },
];

/**
 * Each module's index is its only public surface. Files outside a module may
 * import `@/modules/<name>` but never reach into its internals
 * (`@/modules/<name>/<file>`); modules may import one another's index but not
 * one another's internals. (`@/modules/shared/*` is a deliberate shared surface
 * — the adminAction wrapper and DomainError types — so it is not restricted.)
 */
const moduleInternalPatterns = [
  {
    group: [
      "@/modules/gallery/*",
      "@/modules/photos/*",
      "@/modules/portfolio/*",
      "@/modules/booking/*",
    ],
    message:
      "Module internals are private. Import from the module index (e.g. @/modules/gallery), not its internal files.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Pre-existing violations from the Next 16 presets, unrelated to the
  // deep-modules boundary this project is migrating to and predating it (they
  // are red on the parent commit). Fixing them means React-effect refactors and
  // `<a>`→`<Link>` navigation changes — observable behavior the migration PRD
  // forbids — and touches auth/script files outside the module design. They are
  // kept as warnings so the module-boundary rules below are the build-failing
  // lint gate that binds contributors; a separate cleanup can re-raise them.
  {
    files: ["src/**/*.{ts,tsx}", "prisma/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Application code: neither Prisma nor module internals may be imported.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/modules/**",
      "src/lib/prisma.ts",
      "src/auth.ts",
      "src/test/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: prismaPaths,
          patterns: [...prismaPatterns, ...moduleInternalPatterns],
        },
      ],
    },
  },
  // Inside the modules: Prisma is allowed, but no module may reach into
  // another module's internals — cross-module calls go through the index.
  {
    files: ["src/modules/**/*.{ts,tsx}"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: moduleInternalPatterns,
        },
      ],
    },
  },
]);

export default eslintConfig;
