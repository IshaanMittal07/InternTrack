"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { describeActionError } from "@/components/ui/use-form-action";
import type { ActionResult } from "@/lib/action-result";
import { quickSavePostingAction } from "@/server/actions/opportunities";
import type { QuickSaveOutcome, QuickSaveResult } from "@/server/services/quick-save";

type Input = { url: string; company?: string; role?: string; title?: string };

const HEADINGS: Record<QuickSaveOutcome, string> = {
  created: "Saved to Applied",
  moved: "Moved to Applied",
  already: "Already in Applied",
};

const DETAILS: Record<QuickSaveOutcome, string> = {
  created: "Added with today as the date applied.",
  moved: "It was already in your tracker, so it was moved to Applied with today's date.",
  already: "This posting was already saved as an application, so nothing changed.",
};

/** Saves the posting as soon as the page opens, then shows what happened. */
export function QuickSave({ input }: { input: Input }) {
  const [result, setResult] = useState<ActionResult<QuickSaveResult> | null>(null);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  function save(values: Input) {
    startTransition(async () => {
      try {
        setResult(await quickSavePostingAction(values));
      } catch (error) {
        setResult({ ok: false, error: describeActionError(error, navigator.onLine) });
      }
    });
  }

  useEffect(() => {
    // Once per page load, even when React runs effects twice in development.
    if (started.current) return;
    started.current = true;
    save(input);
  }, [input]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const company = new FormData(event.currentTarget).get("company");
    save({ ...input, company: typeof company === "string" ? company : "" });
  }

  const companyError = result && !result.ok ? result.fieldErrors?.company : undefined;

  if (!result || (pending && !companyError)) {
    return (
      <section className="rounded-xl bg-surface p-6 shadow-card" aria-busy="true">
        <h1 className="text-2xl font-semibold">Saving…</h1>
        <p className="mt-2 text-sm break-all text-ink-muted">{input.url}</p>
      </section>
    );
  }

  if (result.ok) {
    const { id, company, role_title, outcome } = result.data;
    return (
      <section className="rounded-xl bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold">{HEADINGS[outcome]}</h1>
        <p className="mt-3 text-lg font-medium break-words">
          {company}
          {role_title ? ` — ${role_title}` : ""}
        </p>
        <p className="mt-1 text-ink-muted">{DETAILS[outcome]}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/?tab=applied&open=${id}`} className={buttonClasses("primary")}>
            Open in tracker
          </Link>
          <Button variant="secondary" onClick={() => window.close()}>
            Close tab
          </Button>
        </div>
      </section>
    );
  }

  if (companyError) {
    const shownError = pending ? undefined : companyError;
    return (
      <section className="rounded-xl bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold">One more detail</h1>
        <p className="mt-2 text-ink-muted">{result.error}</p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
          <Field id="company" label="Company" required error={shownError}>
            <input
              {...fieldAria("company", shownError)}
              className="input"
              required
              maxLength={120}
              autoFocus
            />
          </Field>
          <Button type="submit" pending={pending}>
            Save as applied
          </Button>
        </form>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-surface p-6 shadow-card">
      <h1 className="text-2xl font-semibold">Couldn&apos;t save this posting</h1>
      <FormStatus error={result.error} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button pending={pending} onClick={() => save(input)}>
          Try again
        </Button>
        <Link href="/?tab=applied" className={buttonClasses("secondary")}>
          Go to tracker
        </Link>
      </div>
    </section>
  );
}
