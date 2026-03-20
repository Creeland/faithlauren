"use client"

import { useActionState } from "react"
import Link from "next/link"
import { login, type LoginState } from "@/app/actions/auth"

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-light tracking-tight text-center mb-8">
          Admin Login
        </h1>

        <form action={action} className="space-y-4">
          {state?.error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {state.error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm text-stone-600 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full border border-stone-300 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm text-stone-600 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full border border-stone-300 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-accent text-white py-3 text-sm tracking-wide hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {pending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center mt-6">
          <Link
            href="/"
            className="text-sm text-stone-500 hover:text-accent transition-colors"
          >
            &larr; Back to site
          </Link>
        </p>
      </div>
    </div>
  )
}
