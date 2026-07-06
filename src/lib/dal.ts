import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/auth"

export const verifyAdmin = cache(async () => {
  const session = await auth()

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login")
  }

  return session
})
