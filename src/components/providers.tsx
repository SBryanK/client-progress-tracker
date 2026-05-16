"use client";

import { SessionProvider } from "next-auth/react";
import { LangProvider } from "@/components/lang-provider";
import { IdentityGate } from "@/components/identity-gate";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LangProvider>
        {children}
        {/* First-visit identity gate. Renders nothing once the user has
            answered (or if they're already signed in / mid-auth). */}
        <IdentityGate />
      </LangProvider>
    </SessionProvider>
  );
}
