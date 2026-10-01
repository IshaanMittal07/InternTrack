/**
 * Content-Security-Policy builder.
 *
 * The CSP tells the browser which sources of scripts, styles, images, etc. are
 * allowed. Scripts must carry a per-request random nonce, so an attacker who
 * manages to inject a <script> tag cannot run it: they can't guess the nonce.
 * `'strict-dynamic'` lets the nonced Next.js runtime load its own chunks.
 */

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildCsp({ nonce, isDev }: { nonce: string; isDev: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React needs `eval` in development only, for better error stacks.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // The dev-only error overlay injects un-nonced <style> tags. Browsers ignore
    // 'unsafe-inline' whenever a nonce is present, so dev drops the nonce here.
    // Production keeps the strict nonce policy.
    "style-src": isDev ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"],
    // All data access is server-side, so the browser only talks to this site.
    "connect-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  // Upgrading http -> https would break local development over http://localhost.
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
