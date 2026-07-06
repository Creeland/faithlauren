"use server";

import { z } from "zod";
import { verifyAdmin } from "@/lib/dal";
import { parseReorderPayload } from "@/lib/reorder";
import { adminAction } from "@/modules/shared/admin-action";
import * as photos from "@/modules/photos";

export const deletePhoto = adminAction(
  z.object({ id: z.string(), galleryId: z.string() }),
  ({ id, galleryId }) => photos.deletePhoto({ gallery: galleryId }, id),
);

export const deleteAllPhotos = adminAction(
  z.object({ galleryId: z.string() }),
  ({ galleryId }) => photos.deleteAllPhotos({ gallery: galleryId }),
);

export const reorderPhotos = adminAction(
  z.object({ galleryId: z.string(), order: z.string() }),
  ({ galleryId, order }) =>
    photos.reorderPhotos({ gallery: galleryId }, parseReorderPayload(order)),
);

export async function getPhotoCount(galleryId: string): Promise<number> {
  await verifyAdmin();
  return photos.countPhotos({ gallery: galleryId });
}
