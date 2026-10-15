import { z } from "zod";

import { microsoftConfig } from "@/lib/email/config";
import { env } from "@/lib/env";
import { createAnonClient } from "@/lib/supabase/anon";
import { processEmails, syncMicrosoft } from "@/server/services/email-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Called by the Gmail Apps Script every few minutes, with no session: the
 * sync key in the Authorization header says whose tracker to update. Each
 * call processes the Gmail messages it carries, then checks any connected
 * Microsoft mailboxes.
 */

const MAX_BODY = 20_000;

const emailSchema = z.object({
  id: z.string().min(1).max(500),
  from: z.string().max(500),
  subject: z.string().transform((s) => s.slice(0, 1000)),
  body: z.string().transform((s) => s.slice(0, MAX_BODY)),
  receivedAt: z.iso.datetime({ offset: true }),
});

const inputSchema = z.object({ messages: z.array(emailSchema).max(50) });

const KEY = /^Bearer ([0-9a-f]{64})$/;

export async function POST(request: Request) {
  const key = request.headers.get("authorization")?.match(KEY)?.[1];
  if (!key) return Response.json({ error: "Missing or malformed sync key." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const input = inputSchema.safeParse(body);
  if (!input.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  const db = createAnonClient();
  const timeZone = env().APP_TIMEZONE;

  // Check the key first, so a wrong key is reported even when the batch
  // holds no rejections and would otherwise never reach the database.
  const check = await db.rpc("email_sync_connections", { p_token: key });
  if (check.error?.code === "42501") {
    return Response.json({ error: "Unknown sync key." }, { status: 401 });
  }
  if (check.error) {
    console.error("[email-sync] key check failed", check.error);
    return Response.json({ error: "Could not process emails. Try again." }, { status: 503 });
  }

  let gmail;
  try {
    gmail = await processEmails(db, key, "gmail", input.data.messages, timeZone);
  } catch (error) {
    console.error("[email-sync] Gmail batch failed", error);
    return Response.json({ error: "Could not process emails. Try again." }, { status: 503 });
  }

  // A Microsoft problem must not make the script resend its Gmail batch, so
  // it is reported but never fails the request.
  let microsoft: Awaited<ReturnType<typeof syncMicrosoft>> = [];
  try {
    const config = microsoftConfig();
    if (config && check.data.length > 0) {
      microsoft = await syncMicrosoft(db, key, config, timeZone);
    }
  } catch (error) {
    console.error("[email-sync] Microsoft sync failed", error);
  }

  return Response.json({ gmail, microsoft });
}
