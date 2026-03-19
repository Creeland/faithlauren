"use client"

import { useState } from "react"

export function MaskedPassword({ password }: { password: string }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="bg-stone-100 dark:bg-stone-800 px-1 rounded">
        {visible ? password : "••••••••"}
      </code>
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={copy}
        className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
        aria-label="Copy password"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  )
}
