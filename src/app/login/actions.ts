"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requestMagicLink, type LoginState } from "@/server/auth/request-magic-link";
import { seedDefaultTags, verifySignInCode, type CodeState } from "@/server/auth/sign-in-code";

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();
  // Next.js already rejects Server Action calls whose Origin doesn't match the host.
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();

  return requestMagicLink({
    rawEmail: formData.get("email"),
    sendLink: (email) =>
      supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/callback` },
      }),
  });
}

export async function signInWithCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const supabase = await createClient();
  const result = await verifySignInCode({
    rawEmail: formData.get("email"),
    rawCode: formData.get("code"),
    verify: (email, token) => supabase.auth.verifyOtp({ email, token, type: "email" }),
  });
  if (!result.ok) return { status: "invalid", message: result.message };

  await seedDefaultTags(supabase);
  redirect("/");
}
