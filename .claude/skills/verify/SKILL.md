---
name: verify
description: Run this app locally against an isolated SQLite DB and drive it as a real HTTP client (including server actions) to verify changes end-to-end.
---

# Verify changes against a locally running app

## Launch (isolated DB — never touch production Turso)

```bash
# 1. Create schema in a throwaway SQLite file (shell env beats .env):
TURSO_DATABASE_URL=file:./.qa.db TURSO_AUTH_TOKEN= pnpm exec tsx prisma/push-to-turso.ts

# 2. Seed with @libsql/client via a .mts script INSIDE the repo root
#    (tsx module resolution fails for scripts under /tmp).
#    Gotcha: push-to-turso.ts can lag schema.prisma — as of 2026-07 it was
#    missing Photo.fileKey; PRAGMA table_info and ALTER TABLE to patch.

# 3. Run dev server on a spare port:
TURSO_DATABASE_URL=file:./.qa.db TURSO_AUTH_TOKEN= pnpm exec next dev -p 3110
# If it crashes with TurbopackInternalError (turbo-persistence range error):
# rm -rf .next and relaunch.
```

## Drive server actions over HTTP (no browser needed)

- **useActionState form (progressive enhancement):** GET the page, scrape the
  hidden inputs (`$ACTION_REF_x`, `$ACTION_x:0`, `$ACTION_x:1`, `$ACTION_KEY`),
  then `curl -X POST <same-url>` with those as `-F` multipart fields plus the
  visible fields, in DOM order. Response is the re-rendered HTML — assert on
  `role="alert"` text and `Set-Cookie` headers.
- **Plain form action:** the form has a single `$ACTION_ID_<hash>` hidden
  input; POST it (empty value) plus the form's other fields.
- **Admin login:** seed a User with a bcryptjs hash, then replay the
  `(auth)/login` useActionState form with `-c jar.txt`; the
  `authjs.session-token` cookie authorizes subsequent /admin requests.
- Spoof client IP with an `x-forwarded-for` header — next dev honors it.

## Cleanup

Kill the dev server, `rm .qa.db` and any seed scripts left in the repo root.
Seed photos must use a hostname allowed in next.config.ts `images`
(e.g. images.unsplash.com), else the page 500s on next/image.
