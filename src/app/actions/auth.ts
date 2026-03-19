"use server"

import { z } from "zod"
import { signIn, signOut } from "@/auth"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

export type LoginState = {
  error?: string
} | undefined

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" }
    }
    throw error
  }

  redirect("/admin")
}

export async function logout() {
  await signOut({ redirect: false })
  redirect("/login")
}
