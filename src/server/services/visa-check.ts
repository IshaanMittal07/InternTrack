import { z } from "zod";

import { ok, validationFailed, type ActionResult } from "@/lib/action-result";
import type { PostingDetails } from "@/lib/domain/posting";
import type { Db } from "@/lib/domain/types";
import { classifyVisaSponsorship, type VisaSponsorship } from "@/lib/domain/visa";
import { uuid } from "@/lib/validation/common";

import { dbFailure } from "./errors";

/** Postings checked per call, so each request stays well within time limits. */
export const VISA_CHECK_BATCH = 5;

export type VisaCheckResult = { id: string; visa: VisaSponsorship | null };

/** Ids of the user's postings whose visa sponsorship hasn't been set yet, newest first. */
export async function listVisaUnchecked(
  db: Db,
  userId: string,
): Promise<ActionResult<{ ids: string[] }>> {
  const { data, error } = await db
    .from("opportunities")
    .select("id")
    .eq("user_id", userId)
    .is("visa_sponsorship", null)
    .order("created_at", { ascending: false });
  if (error) return dbFailure(error, "list unchecked visa sponsorship");
  return ok({ ids: data.map((row) => row.id) });
}

const idsSchema = z.array(uuid).min(1).max(VISA_CHECK_BATCH);

/**
 * Judges visa sponsorship for a few postings from their job description:
 * the posting link is read again (the full description, so saying nothing
 * counts as "maybe"); if it can't be read, only an explicit statement in the
 * saved posting notes counts. When neither tells, the posting stays empty
 * (`visa: null`) rather than guessed. Postings that already have a value,
 * e.g. one set by hand, are never changed.
 */
export async function checkVisaSponsorship(
  db: Db,
  userId: string,
  rawIds: unknown,
  readPosting: (url: string) => Promise<PostingDetails>,
): Promise<ActionResult<{ results: VisaCheckResult[] }>> {
  const ids = idsSchema.safeParse(rawIds);
  if (!ids.success) return validationFailed(ids.error);

  const { data, error } = await db
    .from("opportunities")
    .select("id, posting_url, posting_notes")
    .eq("user_id", userId)
    .is("visa_sponsorship", null)
    .in("id", ids.data);
  if (error) return dbFailure(error, "load postings for visa check");

  const results = await Promise.all(
    data.map(async (posting): Promise<VisaCheckResult> => {
      let visa: VisaSponsorship | undefined;
      if (posting.posting_url) {
        try {
          visa = (await readPosting(posting.posting_url)).visa_sponsorship;
        } catch {
          // Unreadable (closed, sign-in only, ...); try the saved notes.
        }
      }
      visa ??= classifyVisaSponsorship(posting.posting_notes ?? "", { complete: false });
      if (!visa) return { id: posting.id, visa: null };

      const saved = await db
        .from("opportunities")
        .update({ visa_sponsorship: visa })
        .eq("id", posting.id)
        .eq("user_id", userId)
        .is("visa_sponsorship", null);
      if (saved.error) {
        console.error("[db] save visa sponsorship", saved.error);
        return { id: posting.id, visa: null };
      }
      return { id: posting.id, visa };
    }),
  );
  return ok({ results });
}
