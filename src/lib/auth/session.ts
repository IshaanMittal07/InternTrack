import "server-only";

import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

import { isAllowedEmail } from "./allowlist";

/**
 * Verifies the session and the allowlist. Every Server Component that reads
 * data and every Server Action calls this first, so a request that slips past
 * the proxy is still refused.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims || !isAllowedEmail(claims.email, env().ALLOWED_EMAIL)) {
    redirect("/login");
  }

  return { supabase, userId: claims.sub };
}
