"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      // Move focus into the drawer
      closeRef.current?.focus();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Return focus to hamburger button when closing
  useEffect(() => {
    if (!open) {
      openRef.current?.focus();
    }
  }, [open]);

  // Escape key closes menu
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
      }

      // Focus trap: keep Tab within the drawer
      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <div className="sm:hidden">
      <button
        ref={openRef}
        onClick={() => setOpen(true)}
        aria-label="Open menu"
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

      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={close}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            className="absolute top-0 right-0 bottom-0 w-64 bg-background border-l border-stone-200 p-6 flex flex-col"
          >
            <div className="flex justify-end mb-8">
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
            <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
              <a
                href="#work"
                onClick={close}
                className="py-3 text-lg text-stone-600 hover:text-accent transition-colors"
              >
                Work
              </a>
              <a
                href="#about"
                onClick={close}
                className="py-3 text-lg text-stone-600 hover:text-accent transition-colors"
              >
                About
              </a>
              <a
                href="#contact"
                onClick={close}
                className="py-3 text-lg text-stone-600 hover:text-accent transition-colors"
              >
                Contact
              </a>
            </nav>
            <div className="mt-auto">
              <a
                href="#contact"
                onClick={close}
                className="block text-center bg-accent text-white px-6 py-3.5 text-sm tracking-wide hover:bg-accent-hover transition-colors"
              >
                Book a Session
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
