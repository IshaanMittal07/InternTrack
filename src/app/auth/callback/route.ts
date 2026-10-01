import { NextResponse, type NextRequest } from "next/server";

import { isAllowedEmail } from "@/lib/auth/allowlist";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing route. Exchanges the one-time code for a session (PKCE:
 * it only works in the browser that requested the link), re-checks the
 * allowlist, and seeds the default tags on first sign-in.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const failure = NextResponse.redirect(new URL("/login?error=link", request.url));
  if (!code) return failure;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !isAllowedEmail(data.user?.email, env().ALLOWED_EMAIL)) {
    await supabase.auth.signOut();
    return failure;
  }

  const seeded = await supabase.rpc("seed_default_tags");
  if (seeded.error) console.error("Seeding default tags failed", seeded.error);

  return NextResponse.redirect(new URL("/", request.url));
}
