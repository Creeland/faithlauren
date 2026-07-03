import "server-only";
import { cookies } from "next/headers";

// The entire client-access scheme for private galleries lives here: how the
// cookie is named, what value means "in", and how long access lasts. Callers
// only ever ask two questions: grant it, or check it.
const GRANTED = "granted";
const ACCESS_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

function cookieName(slug: string) {
  return `gallery-${slug}-access`;
}

export async function grantGalleryAccess(slug: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName(slug), GRANTED, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_DURATION_SECONDS,
    path: "/",
  });
}

export async function hasGalleryAccess(slug: string): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(cookieName(slug))?.value === GRANTED;
}
