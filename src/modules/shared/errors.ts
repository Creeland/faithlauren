import "server-only";

/**
 * Base class for expected, business-rule failures thrown from inside a domain
 * module (e.g. a duplicate slug, an invalid password). The action layer catches
 * `DomainError` and maps it to the existing form-state shape, while any other
 * thrown value is treated as a real bug and left to propagate to the error
 * boundary.
 *
 * Modules throw; actions map. Nothing outside a module should construct a
 * `DomainError` directly — subclass it for each specific failure.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    // Preserve the concrete subclass name (DuplicateSlugError, ...) rather than
    // the generic "Error", so logs and `instanceof`-adjacent checks read well.
    this.name = new.target.name;
  }
}

/**
 * A record's derived slug collides with an existing one. Slugs are generated
 * from a user-supplied title, so this is an expected, user-facing failure: the
 * action layer catches it and maps it to the relevant form-error message (e.g.
 * "A gallery with this name already exists"). The generic, table-agnostic
 * message stays here so both gallery and portfolio slug collisions can reuse it;
 * the human phrasing lives at the boundary where the entity is known.
 */
export class DuplicateSlugError extends DomainError {
  constructor(public readonly slug: string) {
    super(`A record with the slug "${slug}" already exists`);
  }
}

/**
 * A submitted album password did not match the gallery's stored password, or
 * the gallery does not exist — the two are deliberately indistinguishable to
 * the caller. The action layer catches this and maps it to the single friendly
 * "that password didn't work" message shown to clients.
 */
export class InvalidAlbumPasswordError extends DomainError {
  constructor(public readonly slug: string) {
    super(`Invalid password for gallery "${slug}"`);
  }
}

/**
 * A download request named a photo id that does not belong to the gallery. The
 * client only ever submits ids from the gallery it is viewing, so this signals a
 * tampered or stale request; the download adapter maps it to a 400.
 */
export class InvalidPhotoSelectionError extends DomainError {
  constructor(public readonly photoId: string) {
    super(`Photo "${photoId}" is not part of this gallery`);
  }
}

/**
 * A download resolved to zero photos — an empty gallery, or a selection that
 * filtered everything out. Distinct from a missing gallery: the download adapter
 * maps it to a 404 with the "no photos to download" message.
 */
export class EmptyDownloadError extends DomainError {
  constructor(public readonly slug: string) {
    super(`Gallery "${slug}" has no photos to download`);
  }
}
