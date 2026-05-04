// Shared JSON error helper for API routes.
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/roles";
import { ZodError } from "zod";

export function apiError(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: err.issues },
      { status: 400 },
    );
  }
  if (err instanceof Error) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  return NextResponse.json({ error: "Unknown error" }, { status: 500 });
}
