"use client"

import { useState } from "react"

export function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded text-sm hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
      title="Click to copy"
    >
      <code>{url}</code>
      <span className="text-xs text-stone-400">
        {copied ? "Copied!" : "Copy"}
      </span>
    </button>
  )
}
