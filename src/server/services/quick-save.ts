import { fail, ok, validationFailed, type ActionResult } from "@/lib/action-result";
import { planCategoryMove } from "@/lib/domain/category-move";
import {
  canonicalPostingUrl,
  mergePostingDetails,
  type PostingDetails,
} from "@/lib/domain/posting";
import type { Category } from "@/lib/domain/constants";
import type { Db } from "@/lib/domain/types";
import { quickSaveSchema } from "@/lib/validation/opportunity";

import { createOpportunity } from "./opportunities";
import { dbFailure } from "./errors";

export type QuickSaveOutcome = "created" | "moved" | "already";

export type QuickSaveResult = {
  id: string;
  company: string;
  role_title: string | null;
  /** Where the posting is now, which is Applied when it was kept there. */
  category: Category;
  outcome: QuickSaveOutcome;
};

export const NEEDS_COMPANY = "Couldn't tell which company this posting is for.";

/**
 * Saves the job page the bookmark was clicked on under the chosen category
 * (Applied ones dated today). A posting already in the tracker under the same
 * link is moved there instead of duplicated, except that one already under
 * Applied is never moved out (that would lose its date and stage).
 * `readPosting` reads the posting's details from its link; when that fails,
 * what the browser saw on the page is used.
 */
export async function quickSavePosting(
  db: Db,
  userId: string,
  input: Record<string, unknown>,
  today: string,
  readPosting: (url: string) => Promise<PostingDetails>,
): Promise<ActionResult<QuickSaveResult>> {
  const parsed = quickSaveSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);
  const url = canonicalPostingUrl(parsed.data.url!);
  const { category } = parsed.data;

  const existing = await db
    .from("opportunities")
    .select("id, category, company, role_title, posting_url")
    .eq("user_id", userId)
    .not("posting_url", "is", null);
  if (existing.error) return dbFailure(existing.error, "load opportunities");
  const match = existing.data.find((o) => canonicalPostingUrl(o.posting_url!) === url);

  if (match) {
    const result = { id: match.id, company: match.company, role_title: match.role_title };
    const patch =
      match.category === "applied" ? null : planCategoryMove(match.category, category, { today });
    if (!patch) return ok({ ...result, category: match.category, outcome: "already" });
    const { error } = await db
      .from("opportunities")
      .update(patch)
      .eq("id", match.id)
      .eq("user_id", userId);
    if (error) return dbFailure(error, "move opportunity");
    return ok({ ...result, category, outcome: "moved" });
  }

  let fetched: PostingDetails = {};
  try {
    fetched = await readPosting(url);
  } catch {
    // Many sites refuse server requests; the page's own details still help.
  }
  const details = mergePostingDetails({
    page: { company: parsed.data.company, role_title: parsed.data.role },
    fetched,
    title: parsed.data.title,
    source: url,
  });
  if (!details.company) {
    return fail(NEEDS_COMPANY, { company: "Enter the company name" });
  }

  const created = await createOpportunity(db, userId, {
    category,
    company: details.company,
    role_title: details.role_title,
    posting_url: url,
    location: details.location,
    posting_notes: details.posting_notes,
    deadline: details.deadline,
    visa_sponsorship: details.visa_sponsorship,
    date_applied: category === "applied" ? today : null,
  });
  if (!created.ok) return created;
  return ok({
    id: created.data.id,
    company: details.company,
    role_title: details.role_title ?? null,
    category,
    outcome: "created",
  });
}
