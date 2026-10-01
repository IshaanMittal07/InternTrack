import path from "node:path";

import type { NextConfig } from "next";

/**
 * Static security headers applied to every response.
 *
 * The Content-Security-Policy is NOT set here: it needs a fresh random nonce
 * on every request, so it is generated in `src/proxy.ts` instead.
 */
const securityHeaders = [
  // Never allow the app to be embedded in another site's frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from guessing content types (e.g. running a text file as script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send only the origin (never full URLs with IDs) to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Ask search engines not to index or follow anything on this site.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  // This app needs no camera, microphone, location, etc.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Only ever talk to this site over HTTPS (ignored by browsers on plain http://localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework in an `X-Powered-By` header.
  poweredByHeader: false,
  // Pin the project root so a stray lockfile elsewhere on disk is never picked up.
  turbopack: { root: path.resolve(__dirname) },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
