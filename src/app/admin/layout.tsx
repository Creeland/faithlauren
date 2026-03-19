import { verifyAdmin } from "@/lib/dal"
import { logout } from "@/app/actions/auth"
import Link from "next/link"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifyAdmin()

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-r border-stone-200 dark:border-stone-800 p-6 flex flex-col">
        <Link
          href="/admin"
          className="text-lg tracking-widest uppercase font-light mb-8"
        >
          Faith Lauren
        </Link>

        <nav aria-label="Admin navigation" className="flex flex-col gap-1 text-sm flex-1">
          <Link
            href="/admin"
            className="px-3 py-2 rounded hover:bg-accent-light transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/galleries"
            className="px-3 py-2 rounded hover:bg-accent-light transition-colors"
          >
            Galleries
          </Link>
          <Link
            href="/admin/bookings"
            className="px-3 py-2 rounded hover:bg-accent-light transition-colors"
          >
            Bookings
          </Link>
        </nav>

        <div className="border-t border-stone-200 dark:border-stone-800 pt-4 mt-4">
          <p className="text-xs text-stone-500 mb-2 truncate">
            {session.user.email}
          </p>
          <div className="flex gap-2">
            <a
              href="/"
              className="text-xs text-stone-500 hover:text-accent transition-colors"
            >
              View site
            </a>
            <form action={logout}>
              <button
                type="submit"
                className="text-xs text-stone-500 hover:text-accent transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
