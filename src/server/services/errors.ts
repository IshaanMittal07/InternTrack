import { fail, GENERIC_ERROR, type ActionFailure } from "@/lib/action-result";

type PgError = { code?: string; message?: string } | null;

/** Maps a database error to a safe message. Details are only logged server-side. */
export function dbFailure(error: PgError, context: string): ActionFailure {
  console.error(`[db] ${context}`, error);
  switch (error?.code) {
    case "23505":
      return fail("That already exists.");
    case "23503":
      return fail("A linked item no longer exists. Refresh and try again.");
    case "23514":
      return fail("Some values aren't allowed. Check the form and try again.");
    case "42501":
      return fail("You don't have access to that.");
    default:
      return fail(GENERIC_ERROR);
  }
}

export const NOT_FOUND = fail("That item no longer exists. Refresh and try again.");
