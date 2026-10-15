import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { NextRequest } from "next/server";

/**
 * Shared by the connect and callback routes. The state (against forged
 * callbacks) and the PKCE verifier live in a short-lived httpOnly cookie
 * that only these routes receive.
 */

export const OAUTH_COOKIE = "ms_oauth";
export const OAUTH_COOKIE_PATH = "/api/email/microsoft";

export function callbackUrl(request: NextRequest): string {
  return new URL("/api/email/microsoft/callback", request.nextUrl.origin).toString();
}

export function newOAuthSession() {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge, cookie: `${state}.${verifier}` };
}

export function readOAuthCookie(value: string | undefined) {
  const [state, verifier] = value?.split(".") ?? [];
  return state && verifier ? { state, verifier } : null;
}

export function oauthCookieOptions(request: NextRequest, maxAge: number) {
  return {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    path: OAUTH_COOKIE_PATH,
    maxAge,
  };
}
