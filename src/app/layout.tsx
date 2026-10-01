import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { headers } from "next/headers";

import "./globals.css";

// Fonts are downloaded at build time and served from this site, so the CSP
// needs no third-party font or style sources.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Internship Tracker",
    template: "%s · Internship Tracker",
  },
  description: "A private notebook for tracking an internship search.",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1714" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading request headers makes every page render per request, which is
  // required for the CSP nonce set in src/proxy.ts to reach Next.js' scripts.
  await headers();

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only rounded-lg bg-surface px-4 py-2 text-ink shadow-raised focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
