import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;

export const OWNER = "owner@test.local";
export const OTHER = "other@test.local";
export const STRANGER = "stranger@test.local";
const PASSWORD = "test-only-password-9f2c1e7a";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Is .env.local set up and Supabase running?`);
  return value;
}

const url = () => env("NEXT_PUBLIC_SUPABASE_URL");
const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** Service-role client. Bypasses RLS. Test setup only. */
export function adminClient(): Db {
  return createClient<Database>(url(), env("SUPABASE_SERVICE_ROLE_KEY"), options);
}

/** Client with no session at all (the `anon` role). */
export function anonClient(): Db {
  return createClient<Database>(url(), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), options);
}

/** Creates the user if needed and removes all of their app data. */
export async function ensureUser(email: string): Promise<string> {
  const admin = adminClient();
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  let user = list.users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }
  await admin.from("opportunities").delete().eq("user_id", user.id);
  await admin.from("tags").delete().eq("user_id", user.id);
  return user.id;
}

/** A client signed in as `email`, so every request runs under RLS as that user. */
export async function signedInClient(email: string): Promise<Db> {
  const client = createClient<Database>(url(), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), options);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

export function must<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error("Expected data");
  return result.data;
}
