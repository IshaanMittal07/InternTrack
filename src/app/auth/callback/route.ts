import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { seedDefaultTags } from "@/server/auth/sign-in-code";

/**
 * Magic-link landing route. Exchanges the one-time code for a session (PKCE:
 * it only works in the browser that requested the link) and seeds the default
 * tags on first sign-in.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const failure = NextResponse.redirect(new URL("/login?error=link", request.url));
  if (!code) return failure;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    await supabase.auth.signOut();
    return failure;
  }

  await seedDefaultTags(supabase);

  return NextResponse.redirect(new URL("/", request.url));
}
