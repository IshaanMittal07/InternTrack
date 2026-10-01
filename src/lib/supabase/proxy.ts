import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Env } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Refreshes the Supabase session cookie (if any) and returns the verified
 * claims. `getClaims()` validates the token rather than trusting the cookie.
 */
export async function updateSession(request: NextRequest, requestHeaders: Headers, config: Env) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          // Pass refreshed cookies on to the page being rendered.
          requestHeaders.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  return {
    supabase,
    claims: data?.claims ?? null,
    /** The response, including any refreshed or cleared auth cookies. */
    response: () => response,
  };
}

/** Redirect that keeps any auth cookies set on `from` (e.g. a sign-out). */
export function redirectWithCookies(from: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}
