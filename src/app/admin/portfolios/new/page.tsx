"use client"

import { useActionState } from "react"
import { createPortfolio, type PortfolioState } from "@/app/actions/portfolio"

export default function NewPortfolioPage() {
  const [state, action, pending] = useActionState<PortfolioState, FormData>(
    createPortfolio,
    undefined
  )

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-light tracking-tight mb-8">New Portfolio</h1>

      <form action={action} className="space-y-4">
        {state?.error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {state.error}
          </div>
        )}

        <div>
          <label
            htmlFor="title"
            className="block text-sm text-stone-600 mb-1.5"
          >
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            className="w-full border border-stone-300 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
          />
          {state?.errors?.title && (
            <p className="text-red-600 text-xs mt-1">{state.errors.title}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-white px-6 py-3 text-sm tracking-wide hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create Portfolio"}
        </button>
      </form>
    </div>
  )
}
