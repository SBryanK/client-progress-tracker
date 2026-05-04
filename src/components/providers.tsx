"use client";

import { SessionProvider } from "next-auth/react";
import { LangProvider } from "@/components/lang-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LangProvider>{children}</LangProvider>
    </SessionProvider>
  );
}
