"use server";

import { headers } from "next/headers";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { requestMagicLink, type LoginState } from "@/server/auth/request-magic-link";

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();
  // Next.js already rejects Server Action calls whose Origin doesn't match the host.
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();

  return requestMagicLink({
    rawEmail: formData.get("email"),
    allowedEmail: env().ALLOWED_EMAIL,
    sendLink: (email) =>
      supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
      }),
  });
}
