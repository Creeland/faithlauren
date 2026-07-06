import "server-only";
import { UTApi } from "uploadthing/server";
import type { ReorderItem } from "@/lib/reorder";
import { type Container, resolveDelegate } from "./container";
import { revalidateContainer } from "./revalidate";

const utapi = new UTApi();

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
