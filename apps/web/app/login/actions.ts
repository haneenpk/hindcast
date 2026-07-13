"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionToken,
  verifyAdminSecret,
} from "@/lib/auth";

export interface LoginState {
  error: string | null;
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return { error: "ADMIN_SECRET is not set on the server." };
  }

  const submitted = formData.get("secret");
  if (typeof submitted !== "string" || submitted.length === 0) {
    return { error: "Enter the admin secret." };
  }

  if (!(await verifyAdminSecret(secret, submitted))) {
    return { error: "That's not it." };
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
  redirect("/projects");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
