import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/auth"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const session = await auth()

  // Redirect unauthenticated users away from /admin
  if (pathname.startsWith("/admin") && !session?.user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Redirect authenticated users away from /login
  if (pathname === "/login" && session?.user) {
    return NextResponse.redirect(new URL("/admin", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
