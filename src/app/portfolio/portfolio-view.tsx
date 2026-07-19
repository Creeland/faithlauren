import Image from "next/image";
import Link from "next/link";

type PortfolioViewProps = {
  title: string;
  description?: string | null;
  photos: {
    id: string;
    url: string;
    filename: string;
    width: number | null;
    height: number | null;
  }[];
  backHref: string;
  backLabel: string;
};

export function PortfolioView({
  title,
  description,
  photos,
  backHref,
  backLabel,
}: PortfolioViewProps) {
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
          <h1 className="text-sm text-stone-500">{title}</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {description && (
          <p className="text-stone-600 leading-relaxed mb-10 max-w-2xl">
            {description}
          </p>
        )}
        {photos.length === 0 ? (
          <p className="text-stone-500 text-sm">
            No photos in this portfolio yet.
          </p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
            {photos.map((photo, index) =>
              photo.width && photo.height ? (
                <div
                  key={photo.id}
                  className="break-inside-avoid mb-3 overflow-hidden bg-stone-100"
                >
                  <Image
                    src={photo.url}
                    alt={photo.filename}
                    width={photo.width}
                    height={photo.height}
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="w-full h-auto"
                    priority={index < 3}
                    loading={index < 3 ? undefined : "lazy"}
                  />
                </div>
              ) : (
                <div
                  key={photo.id}
                  className="relative aspect-[3/4] break-inside-avoid mb-3 overflow-hidden bg-stone-100"
                >
                  <Image
                    src={photo.url}
                    alt={photo.filename}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="object-cover"
                    priority={index < 3}
                    loading={index < 3 ? undefined : "lazy"}
                  />
                </div>
              ),
            )}
          </div>
        )}

        <p className="mt-10">
          <Link
            href={backHref}
            className="text-sm text-stone-500 hover:text-accent transition-colors"
          >
            &larr; {backLabel}
          </Link>
        </p>
      </main>
    </div>
  );
}
