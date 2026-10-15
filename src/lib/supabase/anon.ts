import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Supabase client with no session, for requests that prove who they are some
 * other way (the email sync key). It can only call the functions granted to
 * `anon`, which check that key themselves; RLS blocks everything else.
 */
export function createAnonClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();
  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
