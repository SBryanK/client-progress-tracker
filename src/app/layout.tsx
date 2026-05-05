import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Inter — used across body text (descriptions, muted copy). Loaded via
// next/font so it's self-hosted and doesn't incur a layout shift. Exposes
// a CSS variable so the .font-description utility can reference it.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Client Progress Tracker",
  description:
    "Weekly client progress tracker — manage clients, log weekly updates, generate reports.",
  // Per user request: no browser-tab icon. We emit a transparent 1x1 SVG
  // so browsers don't fall back to a 404 or a generic globe glyph.
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfdfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Inline script to set initial dark mode class before first paint so there's
  // no flash of wrong theme. Reads `localStorage.theme` first, falls back to
  // the OS preference.
  const themeInit = `
    try {
      var t = localStorage.getItem('theme');
      if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (t === 'dark') document.documentElement.classList.add('dark');
    } catch (e) {}
  `;
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="font-sans bg-bg text-fg antialiased min-h-screen flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
