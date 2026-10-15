import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { microsoftConfig } from "@/lib/email/config";
import { encryptSecret } from "@/lib/email/crypto";
import { exchangeCode, getAccountEmail } from "@/server/services/microsoft";

import { OAUTH_COOKIE, callbackUrl, oauthCookieOptions, readOAuthCookie } from "@/lib/email/oauth";

export const runtime = "nodejs";

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Microsoft sends the user back here after they allow (or refuse) access.
 * Saves the mailbox for the signed-in user, then returns to the Email sync page.
 */
export async function GET(request: NextRequest) {
  const { supabase } = await requireUser();
  const params = request.nextUrl.searchParams;
  const saved = readOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);

  const finish = (result: string) => {
    const response = NextResponse.redirect(new URL(`/email?microsoft=${result}`, request.url));
    response.cookies.set(OAUTH_COOKIE, "", oauthCookieOptions(request, 0));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };

  const config = microsoftConfig();
  if (!config) return finish("not_configured");

  const error = params.get("error");
  if (error) {
    const description = params.get("error_description") ?? "";
    console.error("[email-sync] Microsoft consent refused", error, description);
    // AADSTS65001 / 90094: the organization requires an admin to approve the app.
    return finish(
      /AADSTS(65001|90094|90095)|admin/i.test(description) ? "admin_consent" : "denied",
    );
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !saved || !sameText(state, saved.state)) return finish("failed");

  try {
    const tokens = await exchangeCode(config, {
      code,
      redirectUri: callbackUrl(request),
      codeVerifier: saved.verifier,
    });
    if (!tokens.refresh_token) throw new Error("Microsoft returned no refresh token");
    const account = await getAccountEmail(tokens.access_token);

    const { error: saveError } = await supabase.rpc("email_connection_save", {
      p_account_email: account,
      p_refresh_token_enc: encryptSecret(tokens.refresh_token, config.encryptionKey),
    });
    if (saveError) throw new Error(`Saving the connection failed: ${saveError.message}`);
  } catch (err) {
    console.error("[email-sync] Microsoft connect failed", err);
    return finish("failed");
  }

  return finish("connected");
}
