import Link from "next/link";
import type { Metadata } from "next";

// The booking form redirects here on success; Google Ads counts a load of
// this URL as a conversion. Noindex keeps it for form submitters only.
export const metadata: Metadata = {
  title: "Thank You",
  robots: { index: false, follow: true },
};

export default function ThankYouPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-stone-200/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
          <Link
            href="/"
            className="text-lg tracking-widest uppercase font-light"
          >
            Faith Lauren
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-16 sm:py-24">
        <div className="max-w-xl mx-auto">
          <p className="text-sm tracking-[0.25em] uppercase text-stone-400 mb-5">
            Request Received
          </p>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight leading-[1.15] mb-6">
            Thank you!
          </h1>
          <p className="text-stone-500 leading-relaxed mb-12">
            Your booking request is on its way to me. I&apos;ll look it over and
            be in touch soon to talk details.
          </p>
          <Link
            href="/#work"
            className="inline-block border-b-2 border-accent pb-1 text-sm tracking-wide text-stone-800 hover:text-accent transition-colors"
          >
            See My Work
          </Link>
        </div>
      </main>

      <footer className="border-t border-stone-200 py-10 px-6">
        <p className="max-w-7xl mx-auto text-sm text-stone-400">
          &copy; 2026 Faith Lauren Photography &middot; Wichita Falls, Texas
        </p>
      </footer>
    </div>
  );
}
