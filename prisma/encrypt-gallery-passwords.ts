// One-time migration: encrypt legacy plaintext Gallery.password rows at
// rest (issue #11). Safe to re-run — already-encrypted rows are skipped,
// and access cookies survive because tokens are derived from the
// plaintext password.
//
// Usage (needs the same env as the app):
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... AUTH_SECRET=... \
//     npx tsx prisma/encrypt-gallery-passwords.ts
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import {
  encryptGalleryPassword,
  isEncryptedGalleryPassword,
} from "../src/lib/gallery-access";

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const galleries = await prisma.gallery.findMany({
    select: { id: true, slug: true, password: true },
  });

  let migrated = 0;
  for (const gallery of galleries) {
    if (isEncryptedGalleryPassword(gallery.password)) continue;
    await prisma.gallery.update({
      where: { id: gallery.id },
      data: { password: encryptGalleryPassword(gallery.password) },
    });
    console.log(`Encrypted password for gallery "${gallery.slug}"`);
    migrated++;
  }

  console.log(
    `Done: ${migrated} of ${galleries.length} galleries migrated ` +
      `(${galleries.length - migrated} already encrypted).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
