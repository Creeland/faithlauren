import "server-only";
import { UTApi } from "uploadthing/server";
import type { ReorderItem } from "@/lib/reorder";
import {
  type Container,
  type UploadedFile,
  resolveDelegate,
} from "./container";
import { revalidateContainer } from "./revalidate";

const utapi = new UTApi();

/**
 * Record a completed upload for a container: create the photo row appended at
 * the end (position assignment lives in the delegate's transaction so parallel
 * uploads never collide), revalidate every page that shows the container, and
 * kick off async image-dimension backfill without blocking the response.
 *
 * This is the single home for upload completion; both UploadThing routers call
 * it instead of duplicating the create/revalidate/backfill dance.
 */
export async function recordUpload(
  container: Container,
  file: UploadedFile,
): Promise<{ id: string }> {
  const { id } = await resolveDelegate(container).appendPhoto(file);
  await revalidateContainer(container);

  // Fire-and-forget: measuring the image must not delay the upload response,
  // and a failure just leaves dimensions null (exactly as before).
  void backfillDimensions(container, id, file.url);

  return { id };
}

/**
 * Fetch a just-uploaded image, read its pixel dimensions with sharp, and store
 * them on the photo row. Best-effort: any failure (fetch, decode, missing
 * metadata) is swallowed, leaving width/height null. Exported so the module's
 * interface tests can await it directly; `recordUpload` runs it detached.
 */
export async function backfillDimensions(
  container: Container,
  photoId: string,
  url: string,
): Promise<void> {
  try {
    const { default: sharp } = await import("sharp");
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const meta = await sharp(Buffer.from(buf)).metadata();
    if (meta.width && meta.height) {
      await resolveDelegate(container).setDimensions(
        photoId,
        meta.width,
        meta.height,
      );
    }
  } catch {
    // Best-effort backfill; leave dimensions unset on any error.
  }
}

/**
 * Delete one photo from its container: remove the stored UploadThing file, then
 * the row (clearing the container's cover if it pointed at this photo), then
 * revalidate. A missing photo is a no-op, not an error — the same forgiving
 * behavior the old action had.
 */
export async function deletePhoto(
  container: Container,
  photoId: string,
): Promise<void> {
  const delegate = resolveDelegate(container);

  const photo = await delegate.findPhoto(photoId);
  if (!photo) return;

  if (photo.fileKey) {
    await utapi.deleteFiles(photo.fileKey);
  }
  await delegate.removePhoto(photoId);
  await revalidateContainer(container);
}

/**
 * Delete every photo in a container, removing all of their stored files
 * together with the rows.
 */
export async function deleteAllPhotos(container: Container): Promise<void> {
  const delegate = resolveDelegate(container);

  const fileKeys = await delegate.fileKeys();
  if (fileKeys.length > 0) {
    await utapi.deleteFiles(fileKeys);
  }
  await delegate.removeAll();
  await revalidateContainer(container);
}

/** Persist a new sort order for the photos in a container. */
export async function reorderPhotos(
  container: Container,
  order: ReorderItem[],
): Promise<void> {
  const delegate = resolveDelegate(container);
  await delegate.reorder(order);
  await revalidateContainer(container);
}

/** Count the photos in a container. */
export function countPhotos(container: Container): Promise<number> {
  return resolveDelegate(container).count();
}
