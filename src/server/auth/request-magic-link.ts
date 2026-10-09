import { z } from "zod";

export const SENT_MESSAGE = "Check your inbox for a sign-in link.";
export const INVALID_EMAIL_MESSAGE = "Enter a valid email address.";

/** Emails are compared trimmed and lowercased everywhere. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const loginSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform(normalizeEmail),
});

export type LoginState =
  { status: "idle" } | { status: "sent"; message: string } | { status: "invalid"; message: string };

/**
 * Sends a magic link to any valid email (creating the account on first use).
 * Always answers with the same message and takes at least `minDurationMs`, so
 * neither the reply nor its timing reveals whether an account already exists.
 */
export async function requestMagicLink({
  rawEmail,
  sendLink,
  minDurationMs = 700,
}: {
  rawEmail: unknown;
  sendLink: (email: string) => Promise<{ error: unknown }>;
  minDurationMs?: number;
}): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: rawEmail });
  if (!parsed.success) return { status: "invalid", message: INVALID_EMAIL_MESSAGE };

  const delay = new Promise((resolve) => setTimeout(resolve, minDurationMs));
  const work = (async () => {
    const { error } = await sendLink(parsed.data.email);
    if (error) console.error("Magic link request failed", error);
  })();

  await Promise.all([work, delay]);
  return { status: "sent", message: SENT_MESSAGE };
}
