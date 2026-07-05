"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import {
  decryptGalleryPassword,
  encryptGalleryPassword,
  galleryAccessCookieName,
  galleryAccessToken,
  isEncryptedGalleryPassword,
  timingSafeEqualStrings,
} from "@/lib/gallery-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

function generatePassword() {
  return crypto.randomBytes(8).toString("hex");
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

const gallerySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

export type GalleryState =
  | {
      error?: string;
      errors?: Record<string, string[]>;
    }
  | undefined;

export async function createGallery(
  _prevState: GalleryState,
  formData: FormData,
): Promise<GalleryState> {
  await verifyAdmin();

  const parsed = gallerySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const slug = slugify(parsed.data.title);

  const existing = await prisma.gallery.findUnique({ where: { slug } });
  if (existing) {
    return { error: "A gallery with this name already exists" };
  }

  await prisma.gallery.create({
    data: {
      title: parsed.data.title,
      slug,
      description: parsed.data.description || null,
      password: encryptGalleryPassword(generatePassword()),
    },
  });

  redirect("/admin/galleries");
}

export async function updateGallery(
  _prevState: GalleryState,
  formData: FormData,
): Promise<GalleryState> {
  await verifyAdmin();

  const id = formData.get("id") as string;
  const parsed = gallerySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await prisma.gallery.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
    },
  });

  revalidatePath(`/admin/galleries/${id}`);
  return undefined;
}

export async function deleteGallery(formData: FormData) {
  await verifyAdmin();
  const id = formData.get("id") as string;

  const photos = await prisma.photo.findMany({
    where: { galleryId: id },
    select: { fileKey: true },
  });
  const fileKeys = photos.map((p) => p.fileKey).filter(Boolean) as string[];
  if (fileKeys.length > 0) {
    await utapi.deleteFiles(fileKeys);
  }

  await prisma.gallery.delete({ where: { id } });
  redirect("/admin/galleries");
}

export async function regeneratePassword(formData: FormData) {
  await verifyAdmin();
  const id = formData.get("id") as string;
  await prisma.gallery.update({
    where: { id },
    data: { password: encryptGalleryPassword(generatePassword()) },
  });
  revalidatePath(`/admin/galleries/${id}`);
}

// Public action for album password verification
export type AlbumPasswordState =
  | {
      error?: string;
    }
  | undefined;

// Per gallery+IP: generous for a legit client mistyping, hostile to scripts.
const ATTEMPTS_PER_IP = 5;
// Per gallery across all IPs: backstop against distributed guessing. High
// enough that an attacker triggering it only delays real clients by a minute.
const ATTEMPTS_PER_GALLERY = 20;
const ATTEMPT_WINDOW_MS = 60_000;

export async function verifyAlbumPassword(
  _prevState: AlbumPasswordState,
  formData: FormData,
): Promise<AlbumPasswordState> {
  const slug = formData.get("slug");
  const password = formData.get("password");

  if (
    typeof slug !== "string" ||
    typeof password !== "string" ||
    !slug ||
    !password
  ) {
    return { error: "Please enter the gallery password." };
  }

  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

  const perIp = checkRateLimit(
    `gallery-password:${slug}:${ip}`,
    ATTEMPTS_PER_IP,
    ATTEMPT_WINDOW_MS,
  );
  const perGallery = checkRateLimit(
    `gallery-password:${slug}`,
    ATTEMPTS_PER_GALLERY,
    ATTEMPT_WINDOW_MS,
  );
  if (!perIp.ok || !perGallery.ok) {
    return {
      error: "Too many password attempts. Please wait a minute and try again.",
    };
  }

  const gallery = await prisma.gallery.findUnique({ where: { slug } });

  if (
    !gallery ||
    !timingSafeEqualStrings(password, decryptGalleryPassword(gallery.password))
  ) {
    return {
      error:
        "That password didn\u2019t work. Check the link your photographer sent you and try again.",
    };
  }

  // Opportunistically move legacy plaintext rows to encrypted storage.
  // The access token is derived from the plaintext, so this doesn't
  // revoke existing cookies.
  if (!isEncryptedGalleryPassword(gallery.password)) {
    await prisma.gallery.update({
      where: { id: gallery.id },
      data: { password: encryptGalleryPassword(password) },
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(galleryAccessCookieName(slug), galleryAccessToken(gallery), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: `/`,
  });

  revalidatePath(`/gallery/${slug}`);
  return undefined;
}
