"use server";

import { z } from "zod";
import { verifyAdmin } from "@/lib/dal";
import { parseReorderPayload } from "@/lib/reorder";
import { adminAction } from "@/modules/shared/admin-action";
import * as photos from "@/modules/photos";

export const deletePortfolioPhoto = adminAction(
  z.object({ id: z.string(), portfolioId: z.string() }),
  ({ id, portfolioId }) => photos.deletePhoto({ portfolio: portfolioId }, id),
);

export const deleteAllPortfolioPhotos = adminAction(
  z.object({ portfolioId: z.string() }),
  ({ portfolioId }) => photos.deleteAllPhotos({ portfolio: portfolioId }),
);

export const reorderPortfolioPhotos = adminAction(
  z.object({ portfolioId: z.string(), order: z.string() }),
  ({ portfolioId, order }) =>
    photos.reorderPhotos(
      { portfolio: portfolioId },
      parseReorderPayload(order),
    ),
);

export async function getPortfolioPhotoCount(
  portfolioId: string,
): Promise<number> {
  await verifyAdmin();
  return photos.countPhotos({ portfolio: portfolioId });
}
