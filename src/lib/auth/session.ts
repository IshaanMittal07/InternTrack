import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Verifies the session. Every Server Component that reads data and every
 * Server Action calls this first, so a request that slips past the proxy is
 * still refused. Data is scoped to the returned `userId` (and by RLS).
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    redirect("/login");
  }

  return { supabase, userId: claims.sub };
}
