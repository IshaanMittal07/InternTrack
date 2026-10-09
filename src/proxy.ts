import { NextResponse, type NextRequest } from "next/server";

import { env, type Env } from "@/lib/env";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { redirectWithCookies, updateSession } from "@/lib/supabase/proxy";

/** Routes reachable without a session. Everything else requires sign-in. */
const PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);

export async function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === "development" });

  // Next.js reads the nonce from the request's CSP header while rendering and
  // stamps it onto its own <script> tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const withCsp = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  let config: Env;
  try {
    config = env();
  } catch (error) {
    // Fail closed: without valid configuration nobody gets in.
    console.error(error);
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);
  const session = await updateSession(request, requestHeaders, config);
  const loginUrl = new URL("/login", request.url);

  if (!session.claims) {
    return isPublic
      ? withCsp(session.response())
      : withCsp(redirectWithCookies(session.response(), loginUrl));
  }

  if (pathname === "/login") {
    return withCsp(redirectWithCookies(session.response(), new URL("/", request.url)));
  }

  return withCsp(session.response());
}

export const config = {
  matcher: [
    {
      // Everything except build assets and public files that need no auth or CSP.
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
