// Shared JSON error helper for API routes.
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/roles";
import { ZodError } from "zod";

/**
 * Lightweight typed error so route handlers can signal "missing resource"
 * (→ 404), "gone / revoked / expired" (→ 410), or "validation" (→ 400)
 * without each one having to build its own NextResponse.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (message = "Not found") => new HttpError(404, message);
export const gone = (message = "Gone") => new HttpError(410, message);
export const badRequest = (message = "Bad request", details?: unknown) =>
  new HttpError(400, message, details);

export function apiError(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: err.message, ...(err.details ? { details: err.details } : {}) },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: err.issues },
      { status: 400 },
    );
  }
  if (err instanceof Error) {
    // Genuine internal errors get masked as 500. We log the real message
    // server-side so it still shows up in the platform's log stream
    // without leaking implementation detail to the client.
    console.error("[api] unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  return NextResponse.json({ error: "Unknown error" }, { status: 500 });
}
