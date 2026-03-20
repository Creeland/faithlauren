"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { logout } from "@/app/actions/auth"

export function AdminMobileNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  const close = useCallback(() => setOpen(false), [])

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      closeRef.current?.focus()
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close()
        openRef.current?.focus()
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, close])

  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/galleries", label: "Galleries" },
    { href: "/admin/bookings", label: "Bookings" },
  ]

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background border-b border-stone-200 px-4 h-14 flex items-center justify-between">
        <Link
          href="/admin"
          className="text-base tracking-widest uppercase font-light"
        >
          Faith Lauren
        </Link>
        <button
          ref={openRef}
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          aria-expanded={open}
          className="w-10 h-10 flex items-center justify-center -mr-2 text-stone-600"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="17" y2="6" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="14" x2="17" y2="14" />
          </svg>
        </button>
      </div>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={close}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            className="absolute top-0 left-0 bottom-0 w-64 bg-background border-r border-stone-200 p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <span className="text-base tracking-widest uppercase font-light">
                Admin
              </span>
              <button
                ref={closeRef}
                onClick={close}
                aria-label="Close menu"
                className="w-10 h-10 flex items-center justify-center -mr-2 text-stone-600"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="5" x2="15" y2="15" />
                  <line x1="15" y1="5" x2="5" y2="15" />
                </svg>
              </button>
            </div>

            <nav aria-label="Admin navigation" className="flex flex-col gap-1 text-sm flex-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2.5 rounded transition-colors ${
                    pathname === link.href
                      ? "bg-accent-light text-accent"
                      : "hover:bg-accent-light"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-stone-200 pt-4 mt-4">
              <p className="text-xs text-stone-500 mb-2 truncate">
                {email}
              </p>
              <div className="flex gap-3">
                <a
                  href="/"
                  className="text-xs text-stone-500 hover:text-accent transition-colors"
                >
                  View site
                </a>
                <span className="text-xs text-stone-300">|</span>
                <form action={logout}>
                  <button
                    type="submit"
                    className="text-xs text-stone-500 hover:text-accent transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
