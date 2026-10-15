import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { microsoftConfig } from "@/lib/email/config";
import { authorizeUrl } from "@/server/services/microsoft";

import { OAUTH_COOKIE, callbackUrl, newOAuthSession, oauthCookieOptions } from "@/lib/email/oauth";

export const runtime = "nodejs";

/** Sends the signed-in user to Microsoft to allow read access to their mailbox. */
export async function GET(request: NextRequest) {
  await requireUser();
  const config = microsoftConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/email?microsoft=not_configured", request.url));
  }

  const session = newOAuthSession();
  const response = NextResponse.redirect(
    authorizeUrl(config, {
      redirectUri: callbackUrl(request),
      state: session.state,
      codeChallenge: session.challenge,
    }),
  );
  response.cookies.set(OAUTH_COOKIE, session.cookie, oauthCookieOptions(request, 600));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
