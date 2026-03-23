"use client"

import { useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"

type LightboxProps = {
  url: string
  alt: string
  onClose: () => void
}

export function Lightbox({ url, alt, onClose }: LightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number | null>(null)
  const translateY = useRef(0)
  const imageRef = useRef<HTMLImageElement>(null)

  const close = useCallback(() => {
    onClose()
  }, [onClose])

  // Lock body scroll and listen for Escape
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.position = "fixed"
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = "0"
    document.body.style.right = "0"

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.position = ""
      document.body.style.top = ""
      document.body.style.left = ""
      document.body.style.right = ""
      window.scrollTo(0, scrollY)
    }
  }, [close])

  // Swipe-down to dismiss (mobile)
  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
    translateY.current = 0
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    const deltaY = e.touches[0].clientY - touchStartY.current
    // Only allow downward drag
    if (deltaY > 0) {
      translateY.current = deltaY
      if (imageRef.current) {
        imageRef.current.style.transform = `translateY(${deltaY}px)`
        imageRef.current.style.opacity = `${Math.max(1 - deltaY / 300, 0.2)}`
      }
    }
  }

  function handleTouchEnd() {
    if (translateY.current > 100) {
      close()
    } else if (imageRef.current) {
      imageRef.current.style.transform = ""
      imageRef.current.style.opacity = ""
    }
    touchStartY.current = null
    translateY.current = 0
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      close()
    }
  }

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={close}
        className="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
        aria-label="Close lightbox"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Full-resolution image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={url}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain select-none transition-[transform,opacity] duration-150 ease-out"
        draggable={false}
      />
    </div>,
    document.body
  )
}
