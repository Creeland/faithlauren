"use client"

import { deletePortfolio } from "@/app/actions/portfolio"

export function DeletePortfolioButton({ portfolioId }: { portfolioId: string }) {
  return (
    <form action={deletePortfolio}>
      <input type="hidden" name="id" value={portfolioId} />
      <button
        type="submit"
        className="text-sm text-red-600 hover:text-red-700 transition-colors"
        onClick={(e) => {
          if (!confirm("Delete this portfolio and all its photos?")) {
            e.preventDefault()
          }
        }}
      >
        Delete Portfolio
      </button>
    </form>
  )
}
