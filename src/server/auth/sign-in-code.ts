import { z } from "zod";

import type { Db } from "@/lib/domain/types";

import { loginSchema } from "./request-magic-link";

export const BAD_CODE_MESSAGE =
  "That code is wrong or has expired. Use the code from the latest email, or request a new one.";

export type CodeState = { status: "idle" } | { status: "invalid"; message: string };

const codeSchema = loginSchema.extend({
  // Spaces are dropped so a code copied as "123 456" still works.
  code: z
    .string()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6,10}$/)),
});

/**
 * Checks the code from the sign-in email. It is the alternative to the link
 * for the home-screen app on iPhone, which doesn't share Safari's sign-in, so
 * the link (opened in Safari) can't sign the app in.
 */
export async function verifySignInCode({
  rawEmail,
  rawCode,
  verify,
}: {
  rawEmail: unknown;
  rawCode: unknown;
  verify: (email: string, code: string) => Promise<{ error: unknown }>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = codeSchema.safeParse({ email: rawEmail, code: rawCode });
  if (!parsed.success) return { ok: false, message: BAD_CODE_MESSAGE };
  const { error } = await verify(parsed.data.email, parsed.data.code);
  return error ? { ok: false, message: BAD_CODE_MESSAGE } : { ok: true };
}

/** Run after every sign-in: gives a new account its default tags (a no-op later). */
export async function seedDefaultTags(supabase: Db): Promise<void> {
  const seeded = await supabase.rpc("seed_default_tags");
  if (seeded.error) console.error("Seeding default tags failed", seeded.error);
}
