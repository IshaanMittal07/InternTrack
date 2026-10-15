import "server-only";

import { parseKey } from "./crypto";

export type MicrosoftConfig = { clientId: string; clientSecret: string; encryptionKey: Buffer };

/**
 * Settings for connecting Microsoft 365 (e.g. a university Outlook) mailboxes.
 * Optional: returns null until MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
 * and EMAIL_ENCRYPTION_KEY are all set. A malformed key throws, so a typo is
 * noticed instead of silently disabling the feature.
 */
export function microsoftConfig(): MicrosoftConfig | null {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const key = process.env.EMAIL_ENCRYPTION_KEY?.trim();
  if (!clientId || !clientSecret || !key) return null;
  return { clientId, clientSecret, encryptionKey: parseKey(key) };
}
