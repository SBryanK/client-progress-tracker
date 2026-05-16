import { redirect } from "next/navigation";

/**
 * Legacy entry point — replaced by the global IdentityGate that lives
 * inside `src/components/identity-gate.tsx` and renders on every public
 * page. We keep this route so old bookmarks don't 404; visitors land on
 * `/` where the gate decides whether to prompt or pass through.
 */
export default function WelcomePage() {
  redirect("/");
}