"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export function NewClientButton() {
  return (
    <Link
      href="/clients/new"
      className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-accent text-accent-fg text-sm font-semibold shadow-sm hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <Plus className="h-4 w-4" aria-hidden />
      Add client
    </Link>
  );
}
