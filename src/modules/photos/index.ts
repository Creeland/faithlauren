import "server-only";

/**
 * The photos module: one interface over both photo tables, parameterized by a
 * Container. This index is the module's only import point — nothing outside the
 * module should reach into `./container`, `./operations`, or `./revalidate`.
 */
export type { Container, UploadedFile } from "./container";
export {
  recordUpload,
  backfillDimensions,
  deletePhoto,
  deleteAllPhotos,
  reorderPhotos,
  countPhotos,
} from "./operations";
