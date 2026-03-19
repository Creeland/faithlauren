import { ThemeToggle } from "./theme-toggle"
import { MobileMenu } from "./mobile-menu"
import { auth } from "@/auth"
import Link from "next/link"
import Image from "next/image"
import { BookingForm } from "./booking-form"

export default async function Home() {
  const session = await auth()

  const work = [
    {
      src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=750&fit=crop&q=80",
      title: "Portrait",
    },
    {
      src: "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=750&fit=crop&q=80",
      title: "Wedding",
    },
    {
      src: "https://images.unsplash.com/photo-1609220136736-443140cffec6?w=600&h=750&fit=crop&q=80",
      title: "Family",
    },
    {
      src: "https://images.unsplash.com/photo-1502258097612-43e695deebad?w=600&h=750&fit=crop&q=80",
      title: "Lifestyle",
    },
    {
      src: "https://images.unsplash.com/photo-1600601622243-f32c30680b0b?w=600&h=750&fit=crop&q=80",
      title: "Boudoir",
    },
    {
      src: "https://images.unsplash.com/photo-1611000273610-f4fb9c7fd0be?w=600&h=750&fit=crop&q=80",
      title: "Sports",
    },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg tracking-widest uppercase font-light"
          >
            Faith Lauren
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <nav
              aria-label="Main navigation"
              className="hidden sm:flex items-center gap-8 text-sm tracking-wide text-stone-600 dark:text-stone-400"
            >
              <a
                href="#work"
                className="hover:text-accent transition-colors py-2"
              >
                Work
              </a>
              <a
                href="#about"
                className="hover:text-accent transition-colors py-2"
              >
                About
              </a>
              {session?.user && (
                <Link
                  href="/admin"
                  className="hover:text-accent transition-colors py-2"
                >
                  Admin
                </Link>
              )}
            </nav>
            <ThemeToggle />
            <a
              href="#contact"
              className="hidden sm:inline-block bg-accent text-white px-5 py-2.5 text-sm tracking-wide hover:bg-accent-hover transition-colors"
            >
              Book a Session
            </a>
            <MobileMenu />
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* Hero */}
        <section className="pt-28 pb-16 sm:pt-44 sm:pb-28 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-5xl font-light tracking-tight leading-[1.15] mb-5 sm:mb-6">
                Portraits, weddings, and
                <br className="hidden sm:block" /> the moments that matter.
              </h1>
              <p className="text-stone-600 dark:text-stone-400 sm:text-lg leading-relaxed mb-8 sm:mb-10 max-w-md">
                Photography by Faith Lauren. Based in North Texas, available
                everywhere.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <a
                  href="#contact"
                  className="bg-accent text-white px-8 py-3.5 sm:py-3 text-sm tracking-wide text-center hover:bg-accent-hover transition-colors"
                >
                  Book a Session
                </a>
                <a
                  href="#work"
                  className="border border-stone-300 dark:border-stone-700 px-8 py-3.5 sm:py-3 text-sm tracking-wide text-center text-stone-600 dark:text-stone-400 hover:border-accent hover:text-accent transition-colors"
                >
                  View Work
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Work — varied grid */}
        <section id="work" className="pb-24 sm:pb-32 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl font-light tracking-tight text-stone-500 dark:text-stone-400 mb-8 border-l-2 border-accent pl-4">
              Selected Work
            </h2>

            {/* Feature row: 2 large images */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
              {work.slice(0, 2).map((item) => (
                <div
                  key={item.title}
                  className="group block overflow-hidden"
                >
                  <div className="relative aspect-[3/4] sm:aspect-[4/5] overflow-hidden bg-stone-100 dark:bg-stone-800">
                    <Image
                      src={item.src}
                      alt={`${item.title} photography by Faith Lauren`}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      priority
                    />
                  </div>
                  <p className="mt-2.5 text-sm text-stone-500 dark:text-stone-400">
                    {item.title}
                  </p>
                </div>
              ))}
            </div>

            {/* Secondary row: 4 smaller images */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {work.slice(2).map((item) => (
                <div
                  key={item.title}
                  className="group block overflow-hidden"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-stone-100 dark:bg-stone-800">
                    <Image
                      src={item.src}
                      alt={`${item.title} photography by Faith Lauren`}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-2.5 text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                    {item.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="py-16 sm:py-28 px-6 bg-accent-subtle">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-16 items-center">
            <div className="relative md:col-span-2 aspect-[3/4] overflow-hidden bg-stone-100 dark:bg-stone-800">
              <Image
                src="/faith.jpg"
                alt="Faith Lauren, photographer"
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className="object-cover"
                loading="lazy"
              />
            </div>
            <div className="md:col-span-3">
              <h2 className="text-2xl sm:text-3xl font-light tracking-tight mb-5">
                About Faith
              </h2>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed mb-8 max-w-lg">
                I&apos;m driven by natural light and authentic moments. My work
                spans portraits, weddings, editorial, and fine art. The best
                photographs happen when people feel comfortable being
                themselves.
              </p>
              <a
                href="#contact"
                className="inline-block border border-stone-300 dark:border-stone-700 px-8 py-3.5 sm:py-3 text-sm tracking-wide hover:border-accent hover:text-accent transition-colors"
              >
                Get in Touch
              </a>
            </div>
          </div>
        </section>

        {/* Contact / Booking */}
        <section id="contact" className="py-20 sm:py-40 px-6">
          <div className="max-w-lg mx-auto">
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-4 text-center">
              Book a Session
            </h2>
            <p className="text-stone-600 dark:text-stone-400 mb-8 sm:mb-10 leading-relaxed text-center">
              Portraits, weddings, or creative collaborations &mdash; let&apos;s
              make something together.
            </p>

            <BookingForm />

            <div className="flex justify-center gap-6 sm:gap-8 mt-10 sm:mt-12 text-sm text-stone-500 dark:text-stone-500">
              <span className="py-2">Instagram</span>
              <span className="py-2">Pinterest</span>
              <span className="py-2">TikTok</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 dark:border-stone-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-stone-400">
            &copy; 2026 Faith Lauren Photography
          </p>
          <nav aria-label="Footer navigation" className="flex gap-6 text-sm text-stone-400">
            <a href="#work" className="hover:text-accent transition-colors">
              Work
            </a>
            <a href="#about" className="hover:text-accent transition-colors">
              About
            </a>
            <a href="#contact" className="hover:text-accent transition-colors">
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
