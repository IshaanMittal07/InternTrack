import type { Metadata } from "next";
import Link from "next/link";

import { GmailSetup } from "@/components/email/gmail-setup";
import { OutlookSection } from "@/components/email/outlook-section";
import { UndoRejectionButton } from "@/components/email/undo-button";
import { Pill, type PillTone } from "@/components/ui/pill";
import { requireUser } from "@/lib/auth/session";
import { microsoftConfig } from "@/lib/email/config";
import { env } from "@/lib/env";
import {
  listConnections,
  listEmailEvents,
  syncKeyCreatedAt,
  type EmailEvent,
} from "@/server/services/email-sync";

export const metadata: Metadata = { title: "Email sync" };

const MICROSOFT_MESSAGES: Record<string, { tone: "success" | "error"; text: string }> = {
  connected: {
    tone: "success",
    text: "Mailbox connected. Click Check now to look through its last 30 days.",
  },
  denied: { tone: "error", text: "Access wasn't allowed, so the mailbox wasn't connected." },
  admin_consent: {
    tone: "error",
    text: "Your organization requires an administrator to approve this app before it can read your mail. Ask your IT service desk to approve it, or forward job emails to your Gmail instead.",
  },
  failed: { tone: "error", text: "Connecting the mailbox didn't work. Please try again." },
  not_configured: { tone: "error", text: "Outlook sync isn't set up on the server yet." },
};

const OUTCOMES: Record<EmailEvent["outcome"], { label: string; tone: PillTone }> = {
  rejected: { label: "Marked Rejected", tone: "slate" },
  skipped: { label: "Not changed", tone: "neutral" },
  ambiguous: { label: "Couldn't tell which application", tone: "warning" },
  unmatched: { label: "No matching application", tone: "warning" },
};

const SKIPPED_HINT =
  "That application was already closed, or the email arrived before you applied.";
const REVIEW_HINT = "Looks like a rejection, but it wasn't applied. Update it yourself if needed.";

export default async function EmailSyncPage({ searchParams }: PageProps<"/email">) {
  const { supabase, userId } = await requireUser();
  const params = await searchParams;
  const timeZone = env().APP_TIMEZONE;
  const outlookReady = microsoftConfig() !== null;

  const [keyCreatedAt, connections, events] = await Promise.all([
    syncKeyCreatedAt(supabase),
    outlookReady ? listConnections(supabase) : Promise.resolve([]),
    listEmailEvents(supabase, userId),
  ]);

  const formatDay = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium" }).format(new Date(iso));
  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );

  const notice =
    typeof params.microsoft === "string" ? MICROSOFT_MESSAGES[params.microsoft] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">Email sync</h1>
        <p className="mt-1 text-ink-muted">
          When a rejection email arrives, the matching application is marked Rejected for you.
        </p>
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`rounded-xl p-4 text-sm ${
            notice.tone === "error" ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
          }`}
        >
          {notice.text}
        </p>
      )}

      <section aria-labelledby="rules-heading" className="rounded-xl bg-surface p-5 shadow-card">
        <h2 id="rules-heading" className="text-lg font-semibold">
          How it decides
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink">
          <li>
            Only clear rejection wording counts, like &quot;we will not be moving forward with your
            application&quot;. Emails that mention an offer or an interview are always ignored.
          </li>
          <li>
            The company must match exactly one of your Applied postings that is still Submitted, in
            Online assessment, or Interviewing. Offers and withdrawn applications are never changed.
          </li>
          <li>
            If it isn&apos;t sure, it changes nothing and lists the email below for you to check.
            Every change can be undone.
          </li>
          <li>Only rejection emails are recorded. Other mail is read and immediately discarded.</li>
        </ul>
      </section>

      <section aria-labelledby="gmail-heading" className="rounded-xl bg-surface p-5 shadow-card">
        <h2 id="gmail-heading" className="mb-3 text-lg font-semibold">
          Gmail
        </h2>
        <GmailSetup keyCreatedOn={keyCreatedAt ? formatDay(keyCreatedAt) : null} />
      </section>

      <section aria-labelledby="outlook-heading" className="rounded-xl bg-surface p-5 shadow-card">
        <h2 id="outlook-heading" className="text-lg font-semibold">
          Outlook (Microsoft 365, e.g. university email)
        </h2>
        <p className="mt-1 mb-3 text-sm text-ink-muted">
          Read-only access. Connected mailboxes are checked each time the Gmail script runs (about
          every 10 minutes), or when you click Check now.
        </p>
        {outlookReady ? (
          <OutlookSection
            mailboxes={connections.map((c) => ({
              id: c.id,
              account_email: c.account_email,
              last_error: c.last_error,
              lastChecked: c.last_synced_at ? formatTime(c.last_synced_at) : null,
            }))}
          />
        ) : (
          <p className="text-ink">
            Not set up on the server yet. Whoever deploys this app needs to register it with
            Microsoft and add its settings (see &quot;Email sync&quot; in DEPLOYMENT.md).
          </p>
        )}
      </section>

      <section aria-labelledby="activity-heading" className="space-y-3">
        <h2 id="activity-heading" className="text-lg font-semibold">
          Rejection emails found
        </h2>
        {events.length === 0 ? (
          <p className="rounded-xl bg-surface p-6 text-ink-muted shadow-card">
            None yet. Rejections found in your inbox will show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => {
              const outcome = e.undone_at
                ? { label: "Undone", tone: "neutral" as const }
                : OUTCOMES[e.outcome];
              return (
                <li key={e.id} className="space-y-2 rounded-xl bg-surface p-4 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium break-words text-ink">
                        {e.subject || "(no subject)"}
                      </p>
                      <p className="text-sm break-words text-ink-muted">
                        {e.sender} · {formatTime(e.received_at)} ·{" "}
                        {e.source === "gmail" ? "Gmail" : "Outlook"}
                      </p>
                    </div>
                    <Pill tone={outcome.tone}>{outcome.label}</Pill>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    {e.opportunity ? (
                      <Link
                        href={`/?tab=applied&open=${e.opportunity.id}`}
                        className="font-medium text-accent-text underline underline-offset-2"
                      >
                        {e.opportunity.company}
                        {e.opportunity.role_title ? ` · ${e.opportunity.role_title}` : ""}
                      </Link>
                    ) : (
                      <span className="text-ink-muted">
                        {e.outcome === "rejected" || e.outcome === "skipped"
                          ? "Application since deleted"
                          : REVIEW_HINT}
                      </span>
                    )}
                    {e.outcome === "skipped" && !e.undone_at && (
                      <span className="text-ink-muted">{SKIPPED_HINT}</span>
                    )}
                    {e.outcome === "rejected" && !e.undone_at && e.opportunity && (
                      <UndoRejectionButton eventId={e.id} company={e.opportunity.company} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
