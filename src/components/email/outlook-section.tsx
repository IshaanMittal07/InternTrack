"use client";

import { useState, useTransition } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormStatus } from "@/components/ui/form-status";
import { Pill } from "@/components/ui/pill";
import { describeActionError } from "@/components/ui/use-form-action";
import { checkMailboxesNowAction, disconnectMailboxAction } from "@/server/actions/email-sync";

export type MailboxView = {
  id: string;
  account_email: string;
  lastChecked: string | null;
  last_error: string | null;
};

/** Connected Microsoft 365 (e.g. university Outlook) mailboxes. */
export function OutlookSection({ mailboxes }: { mailboxes: MailboxView[] }) {
  const [status, setStatus] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  function checkNow() {
    setStatus({});
    startTransition(async () => {
      try {
        const result = await checkMailboxesNowAction();
        setStatus(result.ok ? { success: result.data.message } : { error: result.error });
      } catch (err) {
        setStatus({ error: describeActionError(err, navigator.onLine) });
      }
    });
  }

  return (
    <div className="space-y-4">
      {mailboxes.length > 0 && (
        <ul className="space-y-2">
          {mailboxes.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium text-ink">{m.account_email}</p>
                <p className="text-sm text-ink-muted">
                  {m.lastChecked ? `Last checked ${m.lastChecked}` : "Not checked yet"}
                </p>
                {m.last_error && <Pill tone="danger">{m.last_error}</Pill>}
              </div>
              <ConfirmButton
                title={`Disconnect ${m.account_email}?`}
                message="The tracker stops reading this mailbox and forgets its sign-in. Past activity below is kept."
                confirmLabel="Disconnect"
                onConfirm={() => disconnectMailboxAction(m.id)}
              >
                Disconnect
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* A plain link, not a form: it navigates to Microsoft's sign-in page. */}
        <a
          href="/api/email/microsoft/connect"
          className={buttonClasses(mailboxes.length ? "secondary" : "primary", "sm")}
        >
          {mailboxes.length ? "Connect another mailbox" : "Connect Outlook mailbox"}
        </a>
        {mailboxes.length > 0 && (
          <Button variant="secondary" size="sm" onClick={checkNow} pending={pending}>
            {pending ? "Checking…" : "Check now"}
          </Button>
        )}
      </div>
      <FormStatus error={status.error} success={status.success} />
    </div>
  );
}
