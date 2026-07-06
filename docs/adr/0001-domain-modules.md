# ADR-0001: Consolidate business logic into deep domain modules

- **Status**: accepted
- **Date**: 2026-07-05
- **Related**: PRD "Deep-Modules Architecture Migration" (issue #15), `CONTEXT.md` (domain vocabulary)

## Context

The app grew feature-by-feature as thin server actions over raw Prisma, smearing complexity across call sites instead of hiding it behind interfaces. The same knowledge was written down repeatedly: slug generation existed in three copies, the file-storage cleanup ritual in five, the gallery-access cookie contract in three, and the "append at end of sort order" rule in four. This produced shipped bugs (a forgotten cache revalidation after photo uploads) and live hazards (the plaintext gallery password in scope on the public gallery page, one careless spread away from reaching the browser). Every new feature re-earned correctness by hand.

An autonomous coding agent also commits to this repo. Without mechanical guardrails it reproduces whatever patterns it finds — so the architecture has to be enforced by tooling, not by documentation alone.

## Decision

Consolidate business logic into four deep domain modules under `src/modules/` — **photos**, **gallery**, **portfolio**, **booking** — each exposing a small, verb-based interface that hides its complexity: database access (reads and writes), file-storage cleanup, cache revalidation of its own public pages, and domain invariants (slug uniqueness, sort ordering). Server actions shrink to thin, auth-wrapped adapters between forms and modules. Pages read exclusively through module interfaces and receive shapes from which secrets are structurally absent. ESLint enforces the boundary so it binds every future contributor, human or agent.

Behavior is preserved exactly: this changed where logic lives, not what the site does.

### The two photo tables stay — deliberately

`Photo` (under a gallery) and `PortfolioPhoto` (under a portfolio) are shape-identical tables that exist by copy-paste accident. **Do not "fix" this by merging them.** The split is kept on purpose:

- Merging requires a production data migration; this migration was scoped to zero schema changes and zero data risk.
- The photos module already erases the split for every caller: its interface is parameterized by a `Container` (`{gallery: id} | {portfolio: id}`), and an internal delegate lookup (`src/modules/photos/container.ts`) picks the table. No code outside the module names either table.
- Because callers never see the tables, a future merge changes only the delegate — no caller breaks, and the module-interface tests (which run against a real throwaway database, not mocks) remain valid before and after.

If the tables are ever merged, that is a new ADR superseding this section; the interface contract below must not change.

## Considered alternatives

1. **Merge the two photo tables first, then refactor.** Rejected: requires a production data migration up front, couples the riskiest step to everything else, and delivers no caller-visible benefit that the Container abstraction doesn't already deliver.
2. **Repository/data-access layer only (thin DAL, logic stays in actions).** Rejected: hides the ORM but not the domain knowledge — cleanup rituals, revalidation, and ordering rules would still be repeated per call site, which is the actual source of the shipped bugs.
3. **Keep thin actions, add lint rules and code review discipline alone.** Rejected: lint can forbid imports but cannot make five copies of the file-cleanup ritual become one; duplication itself is the hazard.
4. **One big `domain/` module instead of four.** Rejected: a single surface grows shallow again; four modules keep each interface small enough to read, and PortfolioGroup demonstrably belongs with Portfolio (one showcase concept) rather than in a generic pile.

## Interface contract

These rules are the contract between modules and the rest of the app. They are load-bearing; deviating from any of them is an architectural change that needs a superseding ADR.

- **Module index is the only import point.** App code imports `@/modules/<name>`, never `@/modules/<name>/<file>`. Modules may import one another's index but not internals. `@/modules/shared/*` (adminAction wrapper, `DomainError` types) is a deliberate shared surface.
- **Prisma is module-internal.** The Prisma client and Prisma-generated types are importable only inside `src/modules/` (exemptions: `src/lib/prisma.ts` which constructs the client, `src/auth.ts` for the NextAuth adapter, and test files). Modules export their own named view types.
- **Secrets are structurally absent from public shapes.** A `PublicGalleryView` has no password field; admin reads use separate admin shapes. A gallery password can never reach the browser because no type carries it there.
- **Modules own their revalidation.** Every mutating operation revalidates its own public paths internally; a forgotten-revalidation bug cannot be written by a caller. The photos module revalidates per container type.
- **Auth at the entry points.** Admin server actions are built with the `adminAction` wrapper (`src/modules/shared/admin-action.ts`): admin verification, then Zod parsing, then the handler. Zod schemas stay colocated with actions — form-shaped input is a boundary concern; modules accept already-typed inputs. Modules never touch session or cookies, with one sanctioned exception: the gallery module owns the album-access cookie contract (`grantAccess` / `hasAccess`, 30-day TTL), because album access has no non-request caller and its policy is gallery domain policy.
- **Errors: modules throw, actions map.** Expected business failures are typed `DomainError` subclasses (`DuplicateSlugError`, `GroupNotEmptyError`, `InvalidAlbumPasswordError`, `InvalidPhotoSelectionError`, `EmptyDownloadError`, …); the action layer catches `DomainError` and maps it to form state, while anything else propagates to the error boundary as a real bug. Reads that find nothing return `null`; absence is not an error.
- **Modules are callable without an HTTP request context** (album access excepted), so tests, seed scripts, and maintenance agents can drive domain operations directly.
- **Gallery owns client delivery.** Password verification, access grants, and ZIP building (`buildGalleryDownload`: full gallery or a Selection of photo ids → stream + filename) live in the gallery module; the download route is a thin HTTP adapter.

## Implementation

Landed as ordered, independently shippable steps (issues #16–#25), app green after each: photos → gallery → portfolio → booking → final sweep converting actions to thin wrapped shells and adding the lint rules.

- **Modules**: `src/modules/{photos,gallery,portfolio,booking}/`, each with an `index.ts` documenting and re-exporting its public surface; `src/modules/shared/` holds `admin-action.ts` and `errors.ts`.
- **Boundary enforcement**: `eslint.config.mjs` — `no-restricted-imports` rules forbid `@prisma/client` / `@/lib/prisma` outside modules and forbid module-internal paths everywhere.
- **Tests**: module-interface tests (`src/modules/*/**.test.ts`) run against a real throwaway SQLite database with the schema pushed per run (`src/test/sqlite-harness.ts`); only true externals are mocked (UploadThing, Next cache, cookies). Prisma is never mocked, so a future table merge does not invalidate the suite. Booking is excluded as thin CRUD.

## Verification

- [x] `pnpm run lint` fails on any Prisma import or module-internal import outside `src/modules/`
- [x] `pnpm run typecheck` green
- [x] `pnpm run test` green — module-interface tests cover photos, gallery (incl. download and access), portfolio (incl. groups)
- [x] No route, form, upload, download, or revalidation behavior changed observably (issue #26, manual HITL walkthrough)

## Non-goals

- Merging the two photo tables (see above — deferred by design, interface-protected)
- Any database schema change or data migration
- Hashing gallery passwords — they are photographer-generated random share-tokens; changing this is a separate decision
- Changes to authentication, session handling, the admin role model, the upload provider, or storage layout
- Any user-visible feature, UI, or styling change

## More information

- Domain vocabulary: `CONTEXT.md` (Photo, Container, Gallery, Portfolio, Portfolio Group, Album Access, Selection, Booking) — use these terms in code, issues, and commits.
- 2026-07-05: written retrospectively after the migration landed (issues #16–#25 closed); the original working copy of this ADR was lost to an untracked-file wipe before it could be committed.
