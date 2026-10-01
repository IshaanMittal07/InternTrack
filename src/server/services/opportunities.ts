import { fail, ok, validationFailed, type ActionResult } from "@/lib/action-result";
import { planCategoryMove } from "@/lib/domain/category-move";
import type { Db } from "@/lib/domain/types";
import { formToObject, uuid } from "@/lib/validation/common";
import { moveSchema, opportunitySchema, referralSchema } from "@/lib/validation/opportunity";

import { NOT_FOUND, dbFailure } from "./errors";

/**
 * Opportunity operations. Every function validates its input with Zod and
 * scopes every query to `userId` on top of RLS. Callers (Server Actions) must
 * verify the session first and pass the verified user id.
 */

type Input = FormData | Record<string, unknown>;
const toObject = (input: Input) => (input instanceof FormData ? formToObject(input) : input);

export async function createOpportunity(
  db: Db,
  userId: string,
  input: Input,
): Promise<ActionResult<{ id: string }>> {
  const parsed = opportunitySchema.safeParse(toObject(input));
  if (!parsed.success) return validationFailed(parsed.error);

  const { data, error } = await db
    .from("opportunities")
    .insert({ ...parsed.data, user_id: userId })
    .select("id")
    .single();
  if (error) return dbFailure(error, "create opportunity");
  return ok({ id: data.id });
}

export async function updateOpportunity(
  db: Db,
  userId: string,
  rawId: unknown,
  input: Input,
): Promise<ActionResult> {
  const id = uuid.safeParse(rawId);
  if (!id.success) return NOT_FOUND;

  // Category changes go through moveOpportunity, so keep the stored category.
  const existing = await db
    .from("opportunities")
    .select("category")
    .eq("id", id.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.error) return dbFailure(existing.error, "load opportunity");
  if (!existing.data) return NOT_FOUND;

  const parsed = opportunitySchema.safeParse({
    ...toObject(input),
    category: existing.data.category,
  });
  if (!parsed.success) return validationFailed(parsed.error);

  const { data, error } = await db
    .from("opportunities")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("id");
  if (error) return dbFailure(error, "update opportunity");
  return data.length ? ok() : NOT_FOUND;
}

export async function deleteOpportunity(
  db: Db,
  userId: string,
  rawId: unknown,
): Promise<ActionResult> {
  const id = uuid.safeParse(rawId);
  if (!id.success) return NOT_FOUND;
  const { data, error } = await db
    .from("opportunities")
    .delete()
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("id");
  if (error) return dbFailure(error, "delete opportunity");
  return data.length ? ok() : NOT_FOUND;
}

export async function moveOpportunity(
  db: Db,
  userId: string,
  input: Record<string, unknown>,
  today: string,
): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);

  const existing = await db
    .from("opportunities")
    .select("category")
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.error) return dbFailure(existing.error, "load opportunity");
  if (!existing.data) return NOT_FOUND;

  const patch = planCategoryMove(existing.data.category, parsed.data.to, {
    dateApplied: parsed.data.date_applied,
    today,
  });
  if (!patch) return ok();

  const { error } = await db
    .from("opportunities")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("user_id", userId);
  if (error) return dbFailure(error, "move opportunity");
  return ok();
}

export async function setReferral(
  db: Db,
  userId: string,
  rawId: unknown,
  input: Input,
): Promise<ActionResult> {
  const id = uuid.safeParse(rawId);
  if (!id.success) return NOT_FOUND;
  const parsed = referralSchema.safeParse(toObject(input));
  if (!parsed.success) return validationFailed(parsed.error);

  const contactId = parsed.data.referred_by_contact_id;
  if (contactId) {
    // The referrer must be one of THIS opportunity's contacts.
    const contact = await db
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("opportunity_id", id.data)
      .eq("user_id", userId)
      .maybeSingle();
    if (contact.error) return dbFailure(contact.error, "load referrer");
    if (!contact.data) {
      return fail("Please fix the highlighted fields.", {
        referred_by_contact_id: "Choose one of this opportunity's contacts",
      });
    }
  }

  const { data, error } = await db
    .from("opportunities")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("id");
  if (error) return dbFailure(error, "set referral");
  return data.length ? ok() : NOT_FOUND;
}
