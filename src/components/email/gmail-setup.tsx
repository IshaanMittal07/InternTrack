"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormStatus } from "@/components/ui/form-status";
import { describeActionError } from "@/components/ui/use-form-action";
import { gmailAppsScript } from "@/lib/email/apps-script";
import { createSyncKeyAction, deleteSyncKeyAction } from "@/server/actions/email-sync";

/**
 * Creates the sync key and shows the Apps Script to paste into Google. The
 * key is only stored hashed, so the script can only be shown right after a
 * key is made; replacing the key shows it again (and retires the old one).
 */
export function GmailSetup({ keyCreatedOn }: { keyCreatedOn: string | null }) {
  const [script, setScript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function createKey() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      try {
        const result = await createSyncKeyAction();
        if (result.ok) {
          setScript(gmailAppsScript({ origin: window.location.origin, key: result.data.key }));
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(describeActionError(err, navigator.onLine));
      }
    });
  }

  async function copy() {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      {script ? (
        <>
          <ol className="list-decimal space-y-2 pl-5 text-ink">
            <li>
              Signed in to the Gmail account you want checked, open{" "}
              <a
                href="https://script.google.com/home/projects/create"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-text underline underline-offset-2"
              >
                a new Apps Script project
                <span className="sr-only"> (opens in new tab)</span>
              </a>
              .
            </li>
            <li>Delete the sample code, then paste the script below. Press Ctrl+S to save.</li>
            <li>
              In the toolbar, pick <strong>setup</strong> from the function menu and click{" "}
              <strong>Run</strong>. Allow the access Google asks for. If it says &quot;Google
              hasn&apos;t verified this app&quot;, choose <strong>Advanced</strong>, then{" "}
              <strong>Go to project</strong>: it is your own script.
            </li>
            <li>
              That&apos;s it. It checks your last 30 days now, then new mail every 10 minutes.
            </li>
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={copy}>
              Copy script
            </Button>
            <span role="status" aria-live="polite" className="text-sm text-success">
              {copied ? "Copied" : ""}
            </span>
          </div>
          <label htmlFor="gmail-script" className="sr-only">
            Apps Script code
          </label>
          <textarea
            id="gmail-script"
            readOnly
            value={script}
            rows={12}
            spellCheck={false}
            className="input w-full font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
          <p className="text-sm text-ink-muted">
            The script contains your private sync key. This is the only time it is shown; if you
            lose it, make a new one.
          </p>
        </>
      ) : keyCreatedOn ? (
        <p className="text-ink">
          Gmail sync key created {keyCreatedOn}. If the script is running in your Google account,
          there&apos;s nothing else to do.
        </p>
      ) : (
        <p className="text-ink">
          Create a sync key, then paste the script it gives you into Google Apps Script. It runs in
          your own Google account, so no other service ever sees your mail.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {keyCreatedOn && !script ? (
          <ConfirmButton
            title="Make a new sync key?"
            message="The current key stops working at once. You'll need to paste the new script into Apps Script in place of the old one."
            confirmLabel="Make new key"
            confirmVariant="primary"
            variant="secondary"
            onConfirm={async () => {
              createKey();
              return { ok: true, data: null };
            }}
          >
            New key and script
          </ConfirmButton>
        ) : !script ? (
          <Button variant="primary" size="sm" onClick={createKey} pending={pending}>
            {pending ? "Creating…" : "Create sync key"}
          </Button>
        ) : null}
        {keyCreatedOn && (
          <ConfirmButton
            title="Turn off Gmail sync?"
            message="The sync key is deleted, so the Apps Script can no longer update your tracker. You can also delete the script's project in Google."
            confirmLabel="Turn off"
            onConfirm={async () => {
              const result = await deleteSyncKeyAction();
              if (result.ok) setScript(null);
              return result;
            }}
          >
            Turn off Gmail sync
          </ConfirmButton>
        )}
      </div>
      <FormStatus error={error} />
    </div>
  );
}
