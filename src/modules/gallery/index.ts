import "server-only";

/**
 * The gallery module: the admin gallery lifecycle behind one interface. This
 * index is the module's only import point — nothing outside the module should
 * reach into `./operations` or `./slug`.
 */
export type { GalleryInput } from "./operations";
export {
  createGallery,
  updateGallery,
  deleteGallery,
  regeneratePassword,
} from "./operations";
