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
