"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { describeActionError } from "@/components/ui/use-form-action";
import type { ActionResult } from "@/lib/action-result";
import {
  CATEGORIES,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  type Category,
} from "@/lib/domain/constants";
import { quickSavePostingAction } from "@/server/actions/opportunities";
import type { QuickSaveOutcome, QuickSaveResult } from "@/server/services/quick-save";

type Input = { url: string; company?: string; role?: string; title?: string };

function heading(outcome: QuickSaveOutcome, category: Category): string {
  const label = CATEGORY_LABELS[category];
  if (outcome === "created") return `Saved to ${label}`;
  if (outcome === "moved") return `Moved to ${label}`;
  return `Already in ${label}`;
}

function details(outcome: QuickSaveOutcome, category: Category, chosen: Category): string {
  const dated = category === "applied" ? " with today's date" : "";
  if (outcome === "created") {
    return category === "applied"
      ? "Added with today as the date applied."
      : "Added to your tracker.";
  }
  if (outcome === "moved") {
    return `It was already in your tracker, so it was moved to ${CATEGORY_LABELS[category]}${dated}.`;
  }
  if (category !== chosen) {
    return "This posting was already saved as an application, so it was left under Applied.";
  }
  return "This posting was already saved there, so nothing changed.";
}

/** Asks which category to save the posting under, saves it, then shows what happened. */
export function QuickSave({ input }: { input: Input }) {
  const [category, setCategory] = useState<Category | null>(null);
  const [result, setResult] = useState<ActionResult<QuickSaveResult> | null>(null);
  const [pending, startTransition] = useTransition();

  function save(values: Input, chosen: Category) {
    setCategory(chosen);
    startTransition(async () => {
      try {
        setResult(await quickSavePostingAction({ ...values, category: chosen }));
      } catch (error) {
        setResult({ ok: false, error: describeActionError(error, navigator.onLine) });
      }
    });
  }

  if (!category) {
    return (
      <section className="rounded-xl bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold">Save this posting as…</h1>
        <p className="mt-3 text-lg font-medium break-words">
          {input.company || input.role || input.title || input.url}
          {input.company && input.role ? ` — ${input.role}` : ""}
        </p>
        <p className="mt-1 text-sm break-all text-ink-muted">{input.url}</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c, i) => (
            <button
              key={c}
              type="button"
              autoFocus={i === 0}
              onClick={() => save(input, c)}
              className="rounded-lg border border-line p-3 text-left hover:border-accent focus-visible:border-accent"
            >
              <span className="block font-medium">{CATEGORY_LABELS[c]}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">
                {CATEGORY_DESCRIPTIONS[c]}
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const company = new FormData(event.currentTarget).get("company");
    save({ ...input, company: typeof company === "string" ? company : "" }, category!);
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
    const { id, company, role_title, category: savedIn, outcome } = result.data;
    return (
      <section className="rounded-xl bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold">{heading(outcome, savedIn)}</h1>
        <p className="mt-3 text-lg font-medium break-words">
          {company}
          {role_title ? ` — ${role_title}` : ""}
        </p>
        <p className="mt-1 text-ink-muted">{details(outcome, savedIn, category)}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/?tab=${savedIn}&open=${id}`} className={buttonClasses("primary")}>
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
            Save to {CATEGORY_LABELS[category]}
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
        <Button pending={pending} onClick={() => save(input, category)}>
          Try again
        </Button>
        <Link href={`/?tab=${category}`} className={buttonClasses("secondary")}>
          Go to tracker
        </Link>
      </div>
    </section>
  );
}
