"use client";

import { useState, useTransition, type FormEvent } from "react";

import type { ActionResult } from "@/lib/action-result";

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
      try {
        const next = await action(formData);
        setResult(next);
        if (next.ok) onSuccess?.(next.data, form);
      } catch {
        setResult({ ok: false, error: "Couldn't reach the server. Check your connection." });
      }
    });
  }

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const error = result && !result.ok ? result.error : null;
  return { onSubmit, pending, result, error, fieldErrors, reset: () => setResult(null) };
}
