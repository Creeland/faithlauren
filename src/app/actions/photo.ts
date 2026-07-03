"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import { deleteStoredFiles } from "@/lib/storage";
import { persistOrder } from "@/lib/sortable";

export async function deletePhoto(formData: FormData) {
  await verifyAdmin();
  const id = formData.get("id") as string;
  const photo = await prisma.photo.findUnique({ where: { id } });

  if (photo) {
    await deleteStoredFiles([photo.fileKey]);
    await prisma.photo.delete({ where: { id } });
    revalidatePath(`/admin/galleries/${photo.galleryId}`);
  }
}

export async function deleteAllPhotos(formData: FormData) {
  await verifyAdmin();
  const galleryId = formData.get("galleryId") as string;

  const photos = await prisma.photo.findMany({
    where: { galleryId },
    select: { fileKey: true },
  });
  await deleteStoredFiles(photos.map((p) => p.fileKey));

  await prisma.photo.deleteMany({ where: { galleryId } });
  revalidatePath(`/admin/galleries/${galleryId}`);
}

export async function getPhotoCount(galleryId: string): Promise<number> {
  await verifyAdmin();
  return prisma.photo.count({ where: { galleryId } });
}

export async function reorderPhotos(formData: FormData) {
  await verifyAdmin();
  await persistOrder(prisma.photo, formData);

  const galleryId = formData.get("galleryId") as string;
  revalidatePath(`/admin/galleries/${galleryId}`);
}
