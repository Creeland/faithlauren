import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import sharp from "sharp"

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const photos = await prisma.portfolioPhoto.findMany({
    where: { width: null },
  })

  console.log(`Found ${photos.length} photos without dimensions`)

  let updated = 0
  let failed = 0

  for (const photo of photos) {
    try {
      const res = await fetch(photo.url)
      const buffer = Buffer.from(await res.arrayBuffer())
      const meta = await sharp(buffer).metadata()

      if (meta.width && meta.height) {
        await prisma.portfolioPhoto.update({
          where: { id: photo.id },
          data: { width: meta.width, height: meta.height },
        })
        updated++
        console.log(`  + ${photo.filename}: ${meta.width}x${meta.height}`)
      } else {
        failed++
        console.log(`  x ${photo.filename}: no dimensions in metadata`)
      }
    } catch (e) {
      failed++
      console.log(`  x ${photo.filename}: ${e instanceof Error ? e.message : "unknown error"}`)
    }
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
