import { MobileMenu } from "./mobile-menu"
import { Reveal } from "./reveal"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import Image from "next/image"
import { BookingForm } from "./booking-form"

export default async function Home() {
  const session = await auth()

  const portfolios = await prisma.portfolio.findMany({
    orderBy: { sortOrder: "asc" },
    include: { photos: true },
  })

  const work = portfolios
    .filter((p) => {
      if (!p.coverPhotoId) return false
      return p.photos.some((photo) => photo.id === p.coverPhotoId)
    })
    .map((p) => {
      const coverPhoto = p.photos.find((photo) => photo.id === p.coverPhotoId)!
      return {
        src: coverPhoto.url,
        title: p.title,
        aspect: p.aspectRatio,
        slug: p.slug,
      }
    })

  return (
    <div className="flex flex-col min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm border-b border-stone-200/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg tracking-widest uppercase font-light"
          >
            Faith Lauren
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <nav
              aria-label="Main navigation"
              className="hidden sm:flex items-center gap-8 text-sm tracking-wide text-stone-600"
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
        {/* Hero — full viewport with image */}
        <section className="relative min-h-svh flex items-center">
          <div className="absolute inset-0">
            <Image
              src="/coco.jpeg"
              alt="Portrait session by Faith Lauren"
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-linear-to-t from-stone-950/60 via-stone-950/40 to-stone-950/20 sm:bg-linear-to-r sm:from-stone-950/80 sm:via-stone-950/40 sm:to-transparent" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
            <div className="max-w-xl animate-fade-up">
              <p className="text-sm tracking-[0.3em] uppercase text-white/70 mb-4 sm:mb-5 animate-fade-up animate-delay-1">
                North Texas &mdash; Available Everywhere
              </p>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-light tracking-tight leading-[1.08] mb-6 sm:mb-8 text-white animate-fade-up animate-delay-2">
                Portraits, weddings, and the moments that matter.
              </h1>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 animate-fade-up animate-delay-3">
                <a
                  href="#contact"
                  className="bg-white text-stone-900 px-8 py-3.5 sm:py-3 text-sm tracking-wide text-center hover:bg-stone-100 transition-colors"
                >
                  Book a Session
                </a>
                <a
                  href="#work"
                  className="border border-white/40 text-white px-8 py-3.5 sm:py-3 text-sm tracking-wide text-center hover:border-white hover:bg-white/10 transition-colors"
                >
                  View Work
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Work — staggered masonry grid */}
        {work.length > 0 && (
          <section id="work" className="pt-28 pb-32 sm:pt-44 sm:pb-48 px-6">
            <div className="max-w-7xl mx-auto">
              <Reveal>
                <h2 className="text-sm tracking-[0.25em] uppercase text-stone-400 mb-14 sm:mb-20">
                  Selected Work
                </h2>
              </Reveal>

              <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 sm:gap-6">
                {work.map((item, i) => (
                  <Reveal key={item.title} delay={i * 80}>
                    <Link
                      href={`/portfolio/${item.slug}`}
                      className="group block break-inside-avoid mb-5 sm:mb-6"
                    >
                      <div
                        className={`relative ${item.aspect} overflow-hidden bg-stone-100`}
                      >
                        <Image
                          src={item.src}
                          alt={`${item.title} photography by Faith Lauren`}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                          loading={i < 2 ? "eager" : "lazy"}
                        />
                        <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/20 transition-colors duration-500" />
                        <p className="absolute bottom-0 left-0 right-0 px-5 py-3.5 text-sm tracking-wide text-white translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">
                          {item.title}
                        </p>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* About — dramatic split */}
        <section id="about" className="bg-accent-subtle">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-0 min-h-[80vh]">
            <Reveal className="relative aspect-3/4 md:aspect-auto overflow-hidden bg-stone-100">
              <Image
                src="/faith.jpg"
                alt="Faith Lauren, photographer"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                loading="lazy"
              />
            </Reveal>
            <Reveal
              delay={150}
              className="flex items-center px-6 pb-16 sm:pb-20 md:py-20 md:px-16 lg:px-24"
            >
              <div>
                <p className="text-sm tracking-[0.25em] uppercase text-stone-400 mb-5">
                  About
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight leading-[1.15] mb-7 sm:mb-9">
                  Faith Lauren
                </h2>
                <p className="text-stone-600 text-lg leading-relaxed mb-12 max-w-md">
                  I&apos;m driven by natural light and authentic moments. My
                  work spans portraits, weddings, editorial, and fine art. The
                  best photographs happen when people feel comfortable being
                  themselves.
                </p>
                <a
                  href="#contact"
                  className="inline-block border-b-2 border-accent pb-1 text-sm tracking-wide text-stone-800 hover:text-accent transition-colors"
                >
                  Get in Touch
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Contact / Booking */}
        <section id="contact" className="pt-28 pb-24 sm:pt-44 sm:pb-40 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-32">
            <Reveal>
              <div className="lg:sticky lg:top-32">
                <p className="text-sm tracking-[0.25em] uppercase text-stone-400 mb-5">
                  Contact
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight leading-[1.15] mb-7">
                  Let&apos;s create something together.
                </h2>
                <p className="text-stone-500 leading-relaxed max-w-sm mb-12">
                  Portraits, weddings, or creative collaborations &mdash;
                  I&apos;d love to hear what you have in mind.
                </p>
                <div className="border-t border-stone-200 pt-6 flex gap-8 text-sm text-stone-400">
                  <span>Instagram</span>
                  <span>Pinterest</span>
                  <span>TikTok</span>
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <BookingForm />
            </Reveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-10 sm:py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-stone-400">
            &copy; 2026 Faith Lauren Photography
          </p>
          <nav
            aria-label="Footer navigation"
            className="flex gap-6 text-sm text-stone-400"
          >
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
