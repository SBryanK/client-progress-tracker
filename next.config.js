/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Heavy CJS modules — keep them server-external so Next bundles don't bloat.
  // Moved out of `experimental` per Next.js 15.
  serverExternalPackages: [
    "xlsx",
    "jspdf",
    "jspdf-autotable",
    "docx",
    "mammoth",
    "bcryptjs",
  ],
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  devIndicators: false
};

module.exports = nextConfig;
