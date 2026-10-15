import { ok, validationFailed, type ActionResult } from "@/lib/action-result";
import type { Db } from "@/lib/domain/types";
import { formToObject, uuid } from "@/lib/validation/common";
import { contactSchema } from "@/lib/validation/contact";

import { NOT_FOUND, dbFailure } from "./errors";

type Input = FormData | Record<string, unknown>;
const toObject = (input: Input) => (input instanceof FormData ? formToObject(input) : input);

export async function createContact(
  db: Db,
  userId: string,
  rawOpportunityId: unknown,
  input: Input,
): Promise<ActionResult<{ id: string }>> {
  const opportunityId = uuid.safeParse(rawOpportunityId);
  if (!opportunityId.success) return NOT_FOUND;
  const parsed = contactSchema.safeParse(toObject(input));
  if (!parsed.success) return validationFailed(parsed.error);

  const opportunity = await db
    .from("opportunities")
    .select("id")
    .eq("id", opportunityId.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (opportunity.error) return dbFailure(opportunity.error, "load opportunity");
  if (!opportunity.data) return NOT_FOUND;

  const { data, error } = await db
    .from("contacts")
    .insert({ ...parsed.data, opportunity_id: opportunityId.data, user_id: userId })
    .select("id")
    .single();
  if (error) return dbFailure(error, "create contact");

  // Adding someone from LinkedIn means a connection request went out, so the
  // posting is tagged "Connection sent" unless it already is.
  if (parsed.data.linkedin_url) {
    const marked = await db
      .from("opportunities")
      .update({ linkedin_connection: "sent" })
      .eq("id", opportunityId.data)
      .eq("user_id", userId)
      .or("linkedin_connection.is.null,linkedin_connection.eq.not_sent");
    // The contact is saved either way; the tag can still be set by hand.
    if (marked.error) console.error("Failed to mark LinkedIn connection sent", marked.error);
  }
  return ok({ id: data.id });
}

export async function updateContact(
  db: Db,
  userId: string,
  rawId: unknown,
  input: Input,
): Promise<ActionResult> {
  const id = uuid.safeParse(rawId);
  if (!id.success) return NOT_FOUND;
  const parsed = contactSchema.safeParse(toObject(input));
  if (!parsed.success) return validationFailed(parsed.error);

  const { data, error } = await db
    .from("contacts")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("id");
  if (error) return dbFailure(error, "update contact");
  return data.length ? ok() : NOT_FOUND;
}

export async function setContactSpoken(
  db: Db,
  userId: string,
  rawId: unknown,
  rawValue: unknown,
): Promise<ActionResult> {
  const id = uuid.safeParse(rawId);
  if (!id.success || typeof rawValue !== "boolean") return NOT_FOUND;
  const { data, error } = await db
    .from("contacts")
    .update({ has_spoken: rawValue })
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("id");
  if (error) return dbFailure(error, "toggle spoken");
  return data.length ? ok() : NOT_FOUND;
}

export async function deleteContact(db: Db, userId: string, rawId: unknown): Promise<ActionResult> {
  const id = uuid.safeParse(rawId);
  if (!id.success) return NOT_FOUND;
  const { data, error } = await db
    .from("contacts")
    .delete()
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("id");
  if (error) return dbFailure(error, "delete contact");
  return data.length ? ok() : NOT_FOUND;
}
