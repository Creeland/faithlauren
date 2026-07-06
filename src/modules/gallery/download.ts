import "server-only";
import archiver from "archiver";
import { PassThrough } from "stream";
import { isAllowedPhotoUrl } from "@/lib/photo-url";
import {
  EmptyDownloadError,
  InvalidPhotoSelectionError,
} from "@/modules/shared/errors";
import { getPublicGallery, type PublicPhoto } from "./access";

/**
 * ZIP download of a gallery, owned by the module. The archiver dependency and
 * the per-photo fetch-and-append loop are internal details here; the HTTP route
 * only checks access, calls {@link buildGalleryDownload}, and writes headers.
 */

/** A ready-to-stream ZIP: the response body and its download filename. */
export interface GalleryDownload {
  stream: ReadableStream<Uint8Array>;
  filename: string;
}

/**
 * Build a ZIP download for a gallery.
 *
 * With no `photoIds`, the whole gallery is archived (in display order). With a
 * selection, only those photos are included; every id must belong to the
 * gallery or {@link InvalidPhotoSelectionError} is thrown (a tampered/stale
 * request). A resolved-empty set — an empty gallery, or a selection that matched
 * nothing — throws {@link EmptyDownloadError}. Returns `null` if the gallery
 * does not exist (e.g. deleted between the caller's access check and this call).
 *
 * The `photoIds` distinction is deliberate: `undefined` means "full gallery",
 * while an empty array means "a selection that happens to be empty" and yields
 * an {@link EmptyDownloadError}, matching the route's prior behavior.
 */
export async function buildGalleryDownload(
  slug: string,
  photoIds?: string[],
): Promise<GalleryDownload | null> {
  const gallery = await getPublicGallery(slug);
  if (!gallery) return null;

  let photos = gallery.photos;
  if (photoIds !== undefined) {
    const requested = new Set(photoIds);
    const available = new Set(photos.map((p) => p.id));
    for (const id of requested) {
      if (!available.has(id)) throw new InvalidPhotoSelectionError(id);
    }
    photos = photos.filter((p) => requested.has(p.id));
  }

  if (photos.length === 0) throw new EmptyDownloadError(slug);

  return {
    stream: await buildArchiveStream(photos),
    filename: `${sanitizeFilename(gallery.title)}.zip`,
  };
}

/** Strip a gallery title down to a safe, human-readable ZIP filename stem. */
function sanitizeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
}

/**
 * Build a ZIP of the given photos and expose it as a web `ReadableStream`. Each
 * photo's URL is fetched server-side and appended; a photo whose URL is off the
 * upload-host allowlist or whose fetch fails is skipped rather than aborting the
 * archive (as the route did before). All fetches complete before the stream is
 * returned, mirroring the original route.
 */
async function buildArchiveStream(
  photos: PublicPhoto[],
): Promise<ReadableStream<Uint8Array>> {
  const passthrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 5 } });
  archive.pipe(passthrough);

  for (const photo of photos) {
    // photo.url is admin-controlled; only fetch known upload/image hosts
    // (matching next.config.ts remotePatterns) to avoid server-side SSRF.
    if (!isAllowedPhotoUrl(photo.url)) continue;
    const response = await fetch(photo.url);
    if (!response.ok) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    archive.append(buffer, { name: photo.filename });
  }

  archive.finalize();

  return new ReadableStream({
    start(controller) {
      passthrough.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      passthrough.on("end", () => {
        controller.close();
      });
      passthrough.on("error", (err) => {
        controller.error(err);
      });
    },
  });
}
