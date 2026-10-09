"use client";

import { useState, useTransition, type FormEvent } from "react";

import type { ActionResult } from "@/lib/action-result";

export const OFFLINE_ERROR = "Couldn't reach the server. Check your connection.";
export const OUTDATED_ERROR =
  "The app was updated since this page loaded. Refresh the page and try again.";
export const UNEXPECTED_ERROR = "Something went wrong while saving. Please try again.";

/**
 * Explains why a Server Action call threw. After a new deployment, a page
 * loaded earlier still calls the old action ids, which the new server no
 * longer knows; only a refresh fixes that.
 */
export function describeActionError(error: unknown, online: boolean): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Server Action|failed-to-find-server-action/i.test(message)) return OUTDATED_ERROR;
  if (!online) return OFFLINE_ERROR;
  return UNEXPECTED_ERROR;
}

/**
 * Submits a form to a Server Action, tracking pending state and the result.
 * Uses onSubmit (not the `action` prop) so React does not reset the fields
 * of edit forms after saving.
 */
export function useFormAction<T>(
  action: (formData: FormData) => Promise<ActionResult<T>>,
  onSuccess?: (data: T, form: HTMLFormElement) => void,
) {
  const [result, setResult] = useState<ActionResult<T> | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      let next: ActionResult<T>;
      try {
        next = await action(formData);
      } catch (error) {
        console.error("Server Action failed", error);
        setResult({ ok: false, error: describeActionError(error, navigator.onLine) });
        return;
      }
      setResult(next);
      // Outside the try: the save succeeded, so a problem here must not be
      // reported as a failed save.
      if (next.ok) onSuccess?.(next.data, form);
    });
  }

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const error = result && !result.ok ? result.error : null;
  return { onSubmit, pending, result, error, fieldErrors, reset: () => setResult(null) };
}
