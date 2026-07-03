import "server-only";
import { prisma } from "@/lib/prisma";

export type StoredUpload = {
  url: string;
  key: string;
  name: string;
};

/**
 * Record an uploaded photo at the end of its gallery. The sort position is
 * claimed inside a transaction so concurrent uploads can't collide, and
 * image dimensions are backfilled asynchronously after the fact.
 */
export async function addGalleryPhoto(galleryId: string, upload: StoredUpload) {
  const photo = await prisma.$transaction(async (tx) => {
    const max = await tx.photo.aggregate({
      where: { galleryId },
      _max: { sortOrder: true },
    });
    return tx.photo.create({
      data: {
        url: upload.url,
        fileKey: upload.key,
        filename: upload.name,
        galleryId,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  });

  backfillDimensions(upload.url, (width, height) =>
    prisma.photo.update({ where: { id: photo.id }, data: { width, height } }),
  );

  return photo;
}

/** Same contract as addGalleryPhoto, for a portfolio's photos. */
export async function addPortfolioPhoto(
  portfolioId: string,
  upload: StoredUpload,
) {
  const photo = await prisma.$transaction(async (tx) => {
    const max = await tx.portfolioPhoto.aggregate({
      where: { portfolioId },
      _max: { sortOrder: true },
    });
    return tx.portfolioPhoto.create({
      data: {
        url: upload.url,
        fileKey: upload.key,
        filename: upload.name,
        portfolioId,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  });

  backfillDimensions(upload.url, (width, height) =>
    prisma.portfolioPhoto.update({
      where: { id: photo.id },
      data: { width, height },
    }),
  );

  return photo;
}

// Backfill dimensions async — don't block the upload response
function backfillDimensions(
  url: string,
  save: (width: number, height: number) => Promise<unknown>,
) {
  import("sharp").then(({ default: sharp }) =>
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buf) => sharp(Buffer.from(buf)).metadata())
      .then((meta) => {
        if (meta.width && meta.height) {
          return save(meta.width, meta.height);
        }
      })
      .catch(() => {}),
  );
}
