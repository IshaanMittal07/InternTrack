"use client";

import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { useFormAction } from "@/components/ui/use-form-action";
import type { JobBoard } from "@/lib/domain/types";
import { createJobBoardAction, deleteJobBoardAction } from "@/server/actions/job-boards";

/** Quick links to the job boards the user checks, e.g. Glassdoor or InternInsider. */
export function JobBoards({ boards }: { boards: JobBoard[] }) {
  const form = useFormAction(
    (formData) => createJobBoardAction(null, formData),
    (_data, el) => el.reset(),
  );
  const errors = form.fieldErrors;

  return (
    <section
      aria-labelledby="job-boards-heading"
      className="space-y-3 rounded-xl bg-surface p-4 shadow-card"
    >
      <h2 id="job-boards-heading" className="text-lg font-semibold">
        Job boards
      </h2>

      {boards.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Save links to the sites where you find postings, like Glassdoor or InternInsider.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {boards.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-1 rounded-full bg-surface-muted py-0.5 pr-1 pl-3 text-sm"
            >
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-text underline underline-offset-2"
              >
                {b.name}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
              <ConfirmButton
                title={`Remove ${b.name}?`}
                message="This link will be removed from your job boards."
                confirmLabel="Remove link"
                className="px-1.5"
                onConfirm={() => deleteJobBoardAction(b.id)}
              >
                <span aria-hidden="true">×</span>
                <span className="sr-only">Remove {b.name}</span>
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={form.onSubmit} noValidate aria-label="Add job board" className="space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <Field id="job-board-name" label="Name" error={errors.name} className="min-w-40 flex-1">
            <input
              id="job-board-name"
              name="name"
              required
              maxLength={60}
              autoComplete="off"
              placeholder="e.g. Glassdoor"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "job-board-name-error" : undefined}
              className="input"
            />
          </Field>
          <Field id="job-board-url" label="Link" error={errors.url} className="min-w-56 flex-[2]">
            <input
              id="job-board-url"
              name="url"
              type="url"
              inputMode="url"
              required
              maxLength={2048}
              placeholder="https://…"
              aria-invalid={errors.url ? true : undefined}
              aria-describedby={errors.url ? "job-board-url-error" : undefined}
              className="input"
            />
          </Field>
          <Button type="submit" variant="secondary" pending={form.pending}>
            {form.pending ? "Adding…" : "Add link"}
          </Button>
        </div>
        <FormStatus error={errors.name || errors.url ? null : form.error} />
      </form>
    </section>
  );
}
