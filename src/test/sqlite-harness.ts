import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { randomUUID } from "crypto";
import { rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Throwaway-SQLite test harness for module-interface tests.
 *
 * Module tests run against a real PrismaClient backed by a fresh on-disk SQLite
 * database — no Prisma mocks. Only true externals (UploadThing, Next's cache,
 * cookies) are mocked in the tests themselves. The schema is pushed per test
 * run by executing the DDL below.
 *
 * The DDL is hand-mirrored from `prisma/schema.prisma`. It cannot be generated
 * from the Prisma CLI here (the schema engine binary does not run in this
 * sandbox), but every statement is exercised by real queries on every test run,
 * so any drift from the schema surfaces immediately as a failing test rather
 * than sitting latent. Keep it in sync when the schema changes.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "emailVerified" DATETIME,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`,
  `CREATE TABLE "Gallery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX "Gallery_slug_key" ON "Gallery"("slug")`,
  `CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileKey" TEXT,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "galleryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "PortfolioGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "coverImageFileKey" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT 'aspect-3/4',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX "PortfolioGroup_slug_key" ON "PortfolioGroup"("slug")`,
  `CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT 'aspect-3/4',
    "coverPhotoId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Portfolio_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PortfolioGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX "Portfolio_slug_key" ON "Portfolio"("slug")`,
  `CREATE TABLE "PortfolioPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "portfolioId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioPhoto_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "sessionType" TEXT NOT NULL,
    "date" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
];

export interface TestDb {
  prisma: PrismaClient;
  /** Push the schema onto the fresh database. Call once before the tests run. */
  push(): Promise<void>;
  /** Disconnect and delete the underlying database file. */
  destroy(): Promise<void>;
}

/**
 * Create a real PrismaClient backed by a fresh, uniquely-named SQLite file.
 * Nothing is created on disk until the first query; `push()` builds the schema.
 */
export function createTestDb(): TestDb {
  const dbPath = join(tmpdir(), `faithlauren-test-${randomUUID()}.db`);
  const url = `file:${dbPath}`;
  const adapter = new PrismaLibSql({ url });
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    push: async () => {
      for (const statement of SCHEMA_STATEMENTS) {
        await prisma.$executeRawUnsafe(statement);
      }
    },
    destroy: async () => {
      await prisma.$disconnect();
      for (const suffix of ["", "-wal", "-shm"]) {
        try {
          rmSync(`${dbPath}${suffix}`);
        } catch {
          // best-effort cleanup
        }
      }
    },
  };
}
