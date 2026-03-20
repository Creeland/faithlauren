"use client"

import { deleteAllPortfolioPhotos } from "@/app/actions/portfolio-photo"

export function DeleteAllPortfolioPhotosButton({ portfolioId }: { portfolioId: string }) {
  return (
    <form
      action={deleteAllPortfolioPhotos}
      onSubmit={(e) => {
        if (!confirm("Delete all photos? This cannot be undone.")) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <button
        type="submit"
        className="text-xs text-red-500 hover:text-red-700 transition-colors"
      >
        Delete All
      </button>
    </form>
  )
}
