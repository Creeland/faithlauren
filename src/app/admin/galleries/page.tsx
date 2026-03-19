import { prisma } from "@/lib/prisma"
import { verifyAdmin } from "@/lib/dal"
import type { Gallery } from "@prisma/client"
import Link from "next/link"
import { MaskedPassword } from "./masked-password"

export default async function GalleriesPage() {
  await verifyAdmin()

  const galleries: (Gallery & { _count: { photos: number } })[] = await prisma.gallery.findMany({
    include: { _count: { select: { photos: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light tracking-tight">Galleries</h1>
        <Link
          href="/admin/galleries/new"
          className="bg-accent text-white px-5 py-2.5 text-sm tracking-wide hover:bg-accent-hover transition-colors"
        >
          New Gallery
        </Link>
      </div>

      {galleries.length === 0 ? (
        <p className="text-stone-500 text-sm">No galleries yet.</p>
      ) : (
        <div className="border border-stone-200 dark:border-stone-800 divide-y divide-stone-200 dark:divide-stone-800">
          {galleries.map((gallery) => (
            <Link
              key={gallery.id}
              href={`/admin/galleries/${gallery.id}`}
              className="block p-4 hover:bg-accent-subtle transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{gallery.title}</p>
                  <p className="text-xs text-stone-500 mt-1">
                    {gallery._count.photos} photo
                    {gallery._count.photos !== 1 ? "s" : ""} &middot;{" "}
                    Password: <MaskedPassword password={gallery.password} />
                  </p>
                </div>
                <p className="text-xs text-stone-400 shrink-0">
                  /gallery/{gallery.slug}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
