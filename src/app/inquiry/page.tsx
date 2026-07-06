import Link from "next/link";
import type { Metadata } from "next";
import { BookingForm } from "@/app/booking-form";

// Google Ads landing page — kept out of the organic index so it never
// competes with the home page, and stripped of navigation so the form is
// the only path forward.
export const metadata: Metadata = {
  title: "Book a Session",
  description:
    "Inquire about a portrait, wedding, family, or lifestyle session with Faith Lauren, a Wichita Falls, Texas photographer serving all of North Texas.",
  robots: { index: false, follow: true },
};

export default function InquiryPage() {
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
            Inquire
          </p>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight leading-[1.15] mb-6">
            Let&apos;s create something together.
          </h1>
          <p className="text-stone-500 leading-relaxed mb-3">
            Whether it&apos;s portraits, a wedding, or a creative collaboration,
            tell me what you have in mind and I&apos;ll be in touch soon.
          </p>
          <p className="text-sm text-stone-400 mb-12">
            Based in Wichita Falls and traveling throughout North Texas.
          </p>

          <BookingForm />
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
