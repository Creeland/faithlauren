import "server-only";

/**
 * The gallery module: the admin gallery lifecycle and the public client-access
 * contract behind one interface. This index is the module's only import point —
 * nothing outside the module should reach into `./operations`, `./access`,
 * `./reads`, or `./slug`.
 */
export type { GalleryInput } from "./operations";
export {
  createGallery,
  updateGallery,
  deleteGallery,
  regeneratePassword,
} from "./operations";

export type {
  AdminPhoto,
  AdminGallerySummary,
  AdminGalleryDetail,
} from "./reads";
export {
  listGalleries,
  getGallery,
  countGalleries,
  countGalleryPhotos,
  galleryExists,
} from "./reads";

export type { PublicGalleryView, PublicPhoto, AccessGrant } from "./access";
export {
  getPublicGallery,
  hasAccess,
  verifyPassword,
  grantAccess,
} from "./access";

export type { GalleryDownload } from "./download";
export { buildGalleryDownload } from "./download";
