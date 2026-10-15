import { ok, fail, type ActionResult } from "@/lib/action-result";
import { todayIn } from "@/lib/domain/dates";
import type { Db } from "@/lib/domain/types";
import type { MicrosoftConfig } from "@/lib/email/config";
import { decryptSecret, encryptSecret } from "@/lib/email/crypto";
import { matchRejection, type AppliedPosting } from "@/lib/email/match";
import { isRejection } from "@/lib/email/rejection";
import type { Enums } from "@/lib/supabase/database.types";
import { uuid } from "@/lib/validation/common";

import { dbFailure, NOT_FOUND } from "./errors";
import { listMessagesSince, MicrosoftReconnectError, refreshAccessToken } from "./microsoft";

export type EmailSource = Enums<"email_source">;

export type IncomingEmail = {
  /** Stable per mailbox: Gmail's message id, or the Internet Message-ID. */
  id: string;
  from: string;
  subject: string;
  body: string;
  /** ISO timestamp. */
  receivedAt: string;
};

export type SyncSummary = { checked: number; rejected: number; needsReview: number };

/** How far back the first sync of a newly connected mailbox looks. */
export const FIRST_SYNC_DAYS = 30;
/** Each sync re-reads a little before the last one, in case of delivery delays. */
const OVERLAP_MS = 15 * 60 * 1000;
/** Mailbox syncs closer together than this are skipped. */
const MIN_INTERVAL_MS = 4 * 60 * 1000;

/**
 * Who a sync acts for. A sync key (from the Gmail script) identifies its
 * owner; without one, the database uses the signed-in user.
 */
function caller(token: string | undefined): { p_token?: string } {
  return token ? { p_token: token } : {};
}

/**
 * Finds the rejections among `emails` and records each one; a clear match
 * marks its posting Rejected. Throws if the database can't be reached, so
 * the caller can retry. Emails already recorded are left alone.
 */
export async function processEmails(
  db: Db,
  token: string | undefined,
  source: EmailSource,
  emails: IncomingEmail[],
  timeZone: string,
): Promise<SyncSummary> {
  const summary: SyncSummary = { checked: emails.length, rejected: 0, needsReview: 0 };
  const rejections = emails
    .filter(isRejection)
    .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
  if (rejections.length === 0) return summary;

  const { data, error } = await db.rpc("email_sync_applied", caller(token));
  if (error) throw new Error(`Failed to load applied postings: ${error.message}`);
  const postings: AppliedPosting[] = data;

  for (const email of rejections) {
    const receivedOn = todayIn(timeZone, new Date(email.receivedAt));
    const match = matchRejection({ ...email, receivedOn }, postings);
    const recorded = await db.rpc("email_sync_record", {
      ...caller(token),
      p_source: source,
      p_message_id: email.id,
      p_received_at: email.receivedAt,
      p_sender: email.from,
      p_subject: email.subject,
      p_outcome: match.outcome,
      ...("opportunityId" in match ? { p_opportunity_id: match.opportunityId } : {}),
    });
    if (recorded.error) throw new Error(`Failed to record email: ${recorded.error.message}`);

    if (recorded.data === "rejected") {
      summary.rejected++;
      const posting = postings.find(
        (p) => "opportunityId" in match && p.id === match.opportunityId,
      );
      if (posting) posting.application_stage = "rejected";
    } else if (recorded.data === "ambiguous" || recorded.data === "unmatched") {
      summary.needsReview++;
    }
  }
  return summary;
}

export type MicrosoftSyncResult = { account: string; ok: boolean; summary?: SyncSummary };

/**
 * Reads new mail from each connected Microsoft mailbox and processes it.
 * One mailbox failing does not stop the others; its error is saved and shown
 * on the Email sync page.
 */
export async function syncMicrosoft(
  db: Db,
  token: string | undefined,
  config: MicrosoftConfig,
  timeZone: string,
  { force = false }: { force?: boolean } = {},
): Promise<MicrosoftSyncResult[]> {
  const { data: connections, error } = await db.rpc("email_sync_connections", caller(token));
  if (error) throw new Error(`Failed to load mailbox connections: ${error.message}`);

  const results: MicrosoftSyncResult[] = [];
  for (const connection of connections) {
    const startedAt = new Date();
    const last = connection.last_synced_at ? Date.parse(connection.last_synced_at) : null;
    if (!force && last !== null && startedAt.getTime() - last < MIN_INTERVAL_MS) continue;

    const since = new Date(
      last === null ? startedAt.getTime() - FIRST_SYNC_DAYS * 86_400_000 : last - OVERLAP_MS,
    );

    try {
      const tokens = await refreshAccessToken(
        config,
        decryptSecret(connection.refresh_token_enc, config.encryptionKey),
      );
      // Save a rotated refresh token straight away, before anything else can fail.
      if (tokens.refresh_token) {
        const saved = await db.rpc("email_sync_update_connection", {
          ...caller(token),
          p_id: connection.id,
          p_refresh_token_enc: encryptSecret(tokens.refresh_token, config.encryptionKey),
        });
        if (saved.error) throw new Error(`Failed to save refreshed token: ${saved.error.message}`);
      }

      const emails = await listMessagesSince(tokens.access_token, since);
      const summary = await processEmails(db, token, "microsoft", emails, timeZone);

      const done = await db.rpc("email_sync_update_connection", {
        ...caller(token),
        p_id: connection.id,
        p_synced_at: startedAt.toISOString(),
      });
      if (done.error) throw new Error(`Failed to save sync time: ${done.error.message}`);
      results.push({ account: connection.account_email, ok: true, summary });
    } catch (err) {
      console.error(`[email-sync] Microsoft mailbox ${connection.id} failed`, err);
      const message =
        err instanceof MicrosoftReconnectError
          ? "Microsoft sign-in expired or was revoked. Connect this mailbox again."
          : "The last check failed. It will be retried automatically.";
      await db.rpc("email_sync_update_connection", {
        ...caller(token),
        p_id: connection.id,
        p_error: message,
      });
      results.push({ account: connection.account_email, ok: false });
    }
  }
  return results;
}

// Signed-in user only ------------------------------------------------------------

export type EmailEvent = {
  id: string;
  received_at: string;
  source: EmailSource;
  sender: string;
  subject: string;
  outcome: Enums<"email_outcome">;
  undone_at: string | null;
  opportunity: { id: string; company: string; role_title: string | null } | null;
};

export async function listEmailEvents(db: Db, userId: string, limit = 50): Promise<EmailEvent[]> {
  const { data, error } = await db
    .from("email_events")
    .select(
      "id, received_at, source, sender, subject, outcome, undone_at, opportunity:opportunities(id, company, role_title)",
    )
    .eq("user_id", userId)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load email activity: ${error.message}`);
  return data;
}

export type MailboxConnection = {
  id: string;
  account_email: string;
  created_at: string;
  last_synced_at: string | null;
  last_error: string | null;
};

export async function listConnections(db: Db): Promise<MailboxConnection[]> {
  const { data, error } = await db.rpc("email_connection_list");
  if (error) throw new Error(`Failed to load mailbox connections: ${error.message}`);
  return data;
}

export async function syncKeyCreatedAt(db: Db): Promise<string | null> {
  const { data, error } = await db.rpc("email_sync_token_created_at");
  if (error) throw new Error(`Failed to load sync key: ${error.message}`);
  return data;
}

export async function createSyncKey(db: Db): Promise<ActionResult<{ key: string }>> {
  const { data, error } = await db.rpc("email_sync_token_create");
  if (error) return dbFailure(error, "create sync key");
  return ok({ key: data });
}

export async function deleteSyncKey(db: Db): Promise<ActionResult> {
  const { error } = await db.rpc("email_sync_token_delete");
  if (error) return dbFailure(error, "delete sync key");
  return ok();
}

export async function deleteConnection(db: Db, rawId: unknown): Promise<ActionResult> {
  const id = uuid.safeParse(rawId);
  if (!id.success) return NOT_FOUND;
  const { data, error } = await db.rpc("email_connection_delete", { p_id: id.data });
  if (error) return dbFailure(error, "delete mailbox connection");
  return data ? ok() : NOT_FOUND;
}

export async function undoRejection(db: Db, rawId: unknown): Promise<ActionResult> {
  const id = uuid.safeParse(rawId);
  if (!id.success) return NOT_FOUND;
  const { data, error } = await db.rpc("email_undo_rejection", { p_event_id: id.data });
  if (error) return dbFailure(error, "undo email rejection");
  return data ? ok() : fail("Nothing to undo: the posting's stage was already changed since.");
}
