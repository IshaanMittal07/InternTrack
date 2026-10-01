import { z } from "zod";

import { isAllowedEmail, normalizeEmail } from "@/lib/auth/allowlist";

export const NEUTRAL_MESSAGE = "If this email is allowed, a link has been sent. Check your inbox.";
export const INVALID_EMAIL_MESSAGE = "Enter a valid email address.";

export const loginSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform(normalizeEmail),
});

export type LoginState =
  { status: "idle" } | { status: "sent"; message: string } | { status: "invalid"; message: string };

/**
 * Sends a magic link ONLY to the allowed email, but always answers with the
 * same message and takes at least `minDurationMs`, so neither the reply nor
 * its timing reveals which address is allowed.
 */
export async function requestMagicLink({
  rawEmail,
  allowedEmail,
  sendLink,
  minDurationMs = 700,
}: {
  rawEmail: unknown;
  allowedEmail: string;
  sendLink: (email: string) => Promise<{ error: unknown }>;
  minDurationMs?: number;
}): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: rawEmail });
  if (!parsed.success) return { status: "invalid", message: INVALID_EMAIL_MESSAGE };

  const delay = new Promise((resolve) => setTimeout(resolve, minDurationMs));
  const work = (async () => {
    if (!isAllowedEmail(parsed.data.email, allowedEmail)) return;
    const { error } = await sendLink(parsed.data.email);
    if (error) console.error("Magic link request failed", error);
  })();

  await Promise.all([work, delay]);
  return { status: "sent", message: NEUTRAL_MESSAGE };
}
