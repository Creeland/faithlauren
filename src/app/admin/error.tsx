"use client"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-xl font-light tracking-tight mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-stone-500 mb-6 max-w-sm">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="bg-accent text-white px-5 py-2.5 text-sm tracking-wide hover:bg-accent-hover transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
