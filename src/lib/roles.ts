// Role guard helpers used by every API route & server action.
// Role-checking happens on the BACKEND as required by the PRD.
import { auth } from "@/lib/auth";

export type Role = "OWNER" | "VIEWER";

export class AuthError extends Error {
  constructor(
    public code: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
  }
}

export async function requireSession() {
  const s = await auth();
  if (!s?.user?.id) throw new AuthError("UNAUTHENTICATED", "Sign in required.");
  return s;
}

export async function requireOwner() {
  const s = await requireSession();
  if (s.user.role !== "OWNER") {
    throw new AuthError("FORBIDDEN", "Only the owner can perform this action.");
  }
  return s;
}

export function isOwner(role?: string | null) {
  return role === "OWNER";
}
