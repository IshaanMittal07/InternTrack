/** Emails are compared trimmed and lowercased everywhere. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True only when `email` is the single allowed address. Fails closed. */
export function isAllowedEmail(email: string | null | undefined, allowed: string): boolean {
  if (!email || !allowed) return false;
  const a = normalizeEmail(email);
  const b = normalizeEmail(allowed);
  return a.length > 0 && a === b;
}
