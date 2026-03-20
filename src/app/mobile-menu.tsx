"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => setMounted(true), []);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        openRef.current &&
        !openRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  // Escape key closes menu
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        openRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const popover = open && mounted
    ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Navigation menu"
          className="fixed top-14 right-4 z-[60] bg-background border border-stone-200 rounded-lg shadow-lg py-2 min-w-[180px] popover-enter"
        >
          <a
            href="#work"
            onClick={close}
            role="menuitem"
            className="block px-5 py-3 text-stone-600 hover:bg-stone-100 hover:text-accent transition-colors"
          >
            Work
          </a>
          <a
            href="#about"
            onClick={close}
            role="menuitem"
            className="block px-5 py-3 text-stone-600 hover:bg-stone-100 hover:text-accent transition-colors"
          >
            About
          </a>
          <a
            href="#contact"
            onClick={close}
            role="menuitem"
            className="block px-5 py-3 text-stone-600 hover:bg-stone-100 hover:text-accent transition-colors"
          >
            Contact
          </a>
          <div className="border-t border-stone-200 mt-2 pt-2 px-3">
            <a
              href="#contact"
              onClick={close}
              role="menuitem"
              className="block text-center bg-accent text-white px-5 py-2.5 text-sm tracking-wide rounded hover:bg-accent-hover transition-colors"
            >
              Book a Session
            </a>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="sm:hidden">
      <button
        ref={openRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-haspopup="menu"
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
      {popover}
    </div>
  );
}
