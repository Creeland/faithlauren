# Domain Vocabulary

The ubiquitous language for this codebase. Use these terms — with these meanings — in code, issues, and commits. Architecture rationale lives in `docs/adr/0001-domain-modules.md`.

## Photo

An uploaded image belonging to exactly one Container: a database row plus a stored file (UploadThing, referenced by `fileKey`). Carries a `sortOrder` within its container and `width`/`height` backfilled after upload. Deleting a Photo always removes the row and the stored file together. Two shape-identical tables exist by copy-paste history (`Photo` under galleries, `PortfolioPhoto` under portfolios); the photos module hides that split — never name the tables outside it, and see the ADR before attempting to merge them.

## Container

Whatever a Photo belongs to: `{ gallery: id } | { portfolio: id }`. The parameter of every photos-module operation, and the abstraction that makes the two photo tables an internal detail. New photos append at the end of their container's sort order.

## Gallery

A password-protected album for delivering photos to a specific client. Has a title-derived unique slug and a photographer-generated random password that acts as a share-token (regenerating it revokes all existing Album Access). Public read shapes structurally omit the password; it can never reach a browser.

## Portfolio

A public showcase collection of Photos with a title-derived unique slug, an optional cover photo, and an aspect ratio for its card. Belongs to at most one Portfolio Group; ordered within its group.

## Portfolio Group

A named, ordered grouping of Portfolios shown on the front page, with its own cover image and slug. Groups and their portfolios form one showcase concept and live together in the portfolio module. A group containing portfolios cannot be deleted.

## Album Access

A client's unlocked state on a Gallery: granted by verifying the gallery password, persisted as an HMAC-signed, httpOnly cookie derived from the gallery's id, slug, and current password, valid for 30 days. Owned entirely by the gallery module (`verifyPassword`, `grantAccess`, `hasAccess`) — the one sanctioned place a module touches cookies. Password regeneration invalidates every outstanding grant.

## Selection

The subset of a Gallery's photo ids a client picks for download. A ZIP download covers either the full gallery or a Selection; every selected id must belong to the gallery (a stray id is a tampered request, rejected as a 400), and a Selection that resolves to zero photos is an empty download, not a silent success.

## Booking

A prospective client's inquiry submitted through the public contact form: name, email, session type, optional phone/date/message. Starts in status `PENDING`; the photographer moves it through her workflow (e.g. approved/declined) from the admin inquiries screen. Thin CRUD by design — the booking module has no domain invariants beyond validation.
