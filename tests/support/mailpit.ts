/** Helpers for the local Mailpit inbox that captures Supabase auth emails. */

const base = () => process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MessageSummary = { ID: string; To: { Address: string }[]; Created: string };

export async function clearInbox(): Promise<void> {
  await fetch(`${base()}/api/v1/messages`, { method: "DELETE" });
}

export async function messagesTo(email: string): Promise<MessageSummary[]> {
  const query = encodeURIComponent(`to:"${email}"`);
  const res = await fetch(`${base()}/api/v1/search?query=${query}`);
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
  const body = (await res.json()) as { messages: MessageSummary[] | null };
  return body.messages ?? [];
}

/** Waits for a magic-link email to `email` and returns the link in it. */
export async function waitForMagicLink(email: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [latest] = await messagesTo(email);
    if (latest) {
      const res = await fetch(`${base()}/api/v1/message/${latest.ID}`);
      const message = (await res.json()) as { Text: string; HTML: string };
      const match = /https?:\/\/[^\s"'<>)]+\/auth\/v1\/verify[^\s"'<>)]+/.exec(
        message.HTML || message.Text,
      );
      if (match) return match[0].replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No magic link email arrived for ${email}`);
}
