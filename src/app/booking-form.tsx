"use client"

import { useActionState } from "react"
import { createBooking, type BookingState } from "@/app/actions/booking"

const sessionTypes = [
  "Portrait",
  "Wedding",
  "Family",
  "Lifestyle",
  "Boudoir",
  "Sports",
  "Other",
]

export function BookingForm() {
  const [state, action, pending] = useActionState<BookingState, FormData>(
    createBooking,
    undefined
  )

  if (state?.success) {
    return (
      <div className="text-center py-8">
        <p className="text-lg font-light mb-2">Thank you!</p>
        <p className="text-sm text-stone-500">
          Your booking request has been submitted. I&apos;ll be in touch soon.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm text-stone-600 dark:text-stone-400 mb-1.5"
          >
            Name *
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full border border-stone-300 dark:border-stone-700 bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
          />
          {state?.errors?.name && (
            <p className="text-red-600 text-xs mt-1">{state.errors.name}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm text-stone-600 dark:text-stone-400 mb-1.5"
          >
            Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full border border-stone-300 dark:border-stone-700 bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
          />
          {state?.errors?.email && (
            <p className="text-red-600 text-xs mt-1">{state.errors.email}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="phone"
            className="block text-sm text-stone-600 dark:text-stone-400 mb-1.5"
          >
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="w-full border border-stone-300 dark:border-stone-700 bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label
            htmlFor="sessionType"
            className="block text-sm text-stone-600 dark:text-stone-400 mb-1.5"
          >
            Session Type *
          </label>
          <select
            id="sessionType"
            name="sessionType"
            required
            className="w-full border border-stone-300 dark:border-stone-700 bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
          >
            <option value="">Select...</option>
            {sessionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {state?.errors?.sessionType && (
            <p className="text-red-600 text-xs mt-1">
              {state.errors.sessionType}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="date"
          className="block text-sm text-stone-600 dark:text-stone-400 mb-1.5"
        >
          Preferred Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          className="w-full border border-stone-300 dark:border-stone-700 bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm text-stone-600 dark:text-stone-400 mb-1.5"
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="w-full border border-stone-300 dark:border-stone-700 bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
          placeholder="Tell me about what you have in mind..."
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-accent text-white py-3.5 text-sm tracking-wide hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {pending ? "Sending..." : "Send Booking Request"}
      </button>
    </form>
  )
}
