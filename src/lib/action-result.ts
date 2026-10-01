import type { z } from "zod";

export type FieldErrors = Record<string, string | undefined>;

export type ActionFailure = { ok: false; error: string; fieldErrors?: FieldErrors };

/** What every Server Action returns to the UI. Never contains raw DB errors. */
export type ActionResult<T = null> = { ok: true; data: T } | ActionFailure;

export function ok(): { ok: true; data: null };
export function ok<T>(data: T): { ok: true; data: T };
export function ok<T>(data?: T) {
  return { ok: true as const, data: data ?? null };
}

export function fail(error: string, fieldErrors?: FieldErrors): ActionFailure {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** First error message per field, for showing next to inputs. */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

export function validationFailed(error: z.ZodError): ActionFailure {
  return fail("Please fix the highlighted fields.", zodFieldErrors(error));
}

export const GENERIC_ERROR = "Something went wrong. Please try again.";
