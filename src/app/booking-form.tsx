"use client";

import { useActionState, useEffect, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { createBooking, type BookingState } from "@/app/actions/booking";

const sessionTypes = [
  "Portrait",
  "Wedding",
  "Family",
  "Lifestyle",
  "Boudoir",
  "Sports",
  "Other",
];

export function BookingForm() {
  const [state, action, pending] = useActionState<BookingState, FormData>(
    createBooking,
    undefined,
  );
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Reset Turnstile after each server response (tokens are single-use)
  useEffect(() => {
    if (state) {
      turnstileRef.current?.reset();
    }
  }, [state]);

  if (state?.success) {
    return (
      <div className="text-center py-8">
        <p className="text-lg font-light mb-2">Thank you!</p>
        <p className="text-sm text-stone-500 mb-6">
          Your booking request has been submitted. I&apos;ll be in touch soon.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-accent hover:text-accent-hover transition-colors"
        >
          Book another session
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="relative flex flex-col gap-5">
      {/* Honeypot — invisible to humans, bots fill it */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="_hp_name">Do not fill this</label>
        <input
          type="text"
          id="_hp_name"
          name="_hp_name"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {state?.error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm"
        >
          {state.error}
        </div>
      )}

      {/* Row 1: Name + Email — tightly paired */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm text-stone-500 mb-2">
            Name *
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full border border-stone-300 bg-background px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
          />
          {state?.errors?.name && (
            <p className="text-red-600 text-xs mt-1.5">{state.errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm text-stone-500 mb-2">
            Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full border border-stone-300 bg-background px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
          />
          {state?.errors?.email && (
            <p className="text-red-600 text-xs mt-1.5">{state.errors.email}</p>
          )}
        </div>
      </div>

      {/* Row 2: Phone + Session Type — tightly paired */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="phone" className="block text-sm text-stone-500 mb-2">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="w-full border border-stone-300 bg-background px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
          />
        </div>

        <div>
          <label
            htmlFor="sessionType"
            className="block text-sm text-stone-500 mb-2"
          >
            Session Type *
          </label>
          <select
            id="sessionType"
            name="sessionType"
            required
            className="w-full border border-stone-300 bg-background px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
          >
            <option value="">Select...</option>
            {sessionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {state?.errors?.sessionType && (
            <p className="text-red-600 text-xs mt-1.5">
              {state.errors.sessionType}
            </p>
          )}
        </div>
      </div>

      {/* Row 3: Date — standalone, slight separation */}
      <div>
        <label htmlFor="date" className="block text-sm text-stone-500 mb-2">
          Preferred Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          className="w-full border border-stone-300 bg-background px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
        />
      </div>

      {/* Row 4: Message — more vertical presence */}
      <div>
        <label htmlFor="message" className="block text-sm text-stone-500 mb-2">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          className="w-full border border-stone-300 bg-background px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
          placeholder="Tell me about what you have in mind..."
        />
      </div>

      {/* Submit — separated from fields for visual weight */}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-accent text-white py-3.5 mt-2 text-sm tracking-wide hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {pending ? "Sending..." : "Send Booking Request"}
      </button>

      {/* CAPTCHA */}
      <Turnstile
        ref={turnstileRef}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
        options={{ theme: "light", size: "flexible" }}
      />
    </form>
  );
}
