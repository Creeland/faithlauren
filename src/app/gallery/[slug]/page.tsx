import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicGallery, hasAccess } from "@/modules/gallery";
import { AlbumPasswordForm } from "./password-form";
import { GalleryClient } from "./gallery-client";
import type { Metadata } from "next";

// Private client deliveries — keep them out of search results. Crawlers must
// be able to fetch the page to see this, so /gallery is not robots-disallowed.
export const metadata: Metadata = {
  title: "Client Gallery",
  robots: { index: false, follow: false },
};

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const gallery = await getPublicGallery(slug);

  if (!gallery) notFound();

  if (!(await hasAccess(slug))) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-light tracking-tight mb-2">
            {gallery.title}
          </h1>
          <p className="text-sm text-stone-500 mb-8">
            Enter the password to view this gallery.
          </p>
          <AlbumPasswordForm slug={slug} />
          <p className="mt-6">
            <a
              href="/"
              className="text-sm text-stone-500 hover:text-accent transition-colors"
            >
              &larr; Back to site
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg tracking-widest uppercase font-light"
          >
            Faith Lauren
          </Link>
          <h1 className="text-sm text-stone-500">{gallery.title}</h1>
        </div>
      </header>

      <GalleryClient
        slug={slug}
        title={gallery.title}
        description={gallery.description}
        photos={gallery.photos}
      />
    </div>
  );
}
