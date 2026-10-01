import { fail, ok, validationFailed, type ActionResult } from "@/lib/action-result";
import { TAG_COLORS, type TagColor } from "@/lib/domain/constants";
import type { Db, Tag } from "@/lib/domain/types";
import { uuid } from "@/lib/validation/common";
import { tagNameSchema, tagSchema, tagUpdateSchema } from "@/lib/validation/tag";

import { NOT_FOUND, dbFailure } from "./errors";

const DUPLICATE = (name: string) =>
  fail("Please fix the highlighted fields.", { name: `You already have a tag named “${name}”` });

/** Picks the palette color used least so far, so new tags vary. */
function nextColor(existing: Pick<Tag, "color">[]): TagColor {
  const counts = new Map<TagColor, number>(TAG_COLORS.map((c) => [c, 0]));
  for (const t of existing) counts.set(t.color, (counts.get(t.color) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[1] - b[1])[0]![0];
}

async function findByName(db: Db, userId: string, name: string) {
  const { data, error } = await db.from("tags").select("*").eq("user_id", userId);
  const all = data ?? [];
  const lower = name.toLowerCase();
  return { error, all, tag: all.find((t) => t.name.toLowerCase() === lower) ?? null };
}

export async function createTag(
  db: Db,
  userId: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);

  const { data, error } = await db
    .from("tags")
    .insert({ ...parsed.data, user_id: userId })
    .select("id")
    .single();
  if (error?.code === "23505") return DUPLICATE(parsed.data.name);
  if (error) return dbFailure(error, "create tag");
  return ok({ id: data.id });
}

export async function updateTag(
  db: Db,
  userId: string,
  rawId: unknown,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const id = uuid.safeParse(rawId);
  if (!id.success) return NOT_FOUND;
  const parsed = tagUpdateSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);

  const { data, error } = await db
    .from("tags")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("id");
  if (error?.code === "23505") return DUPLICATE(parsed.data.name ?? "");
  if (error) return dbFailure(error, "update tag");
  return data.length ? ok() : NOT_FOUND;
}

/** Deletes the tag. Links are removed by cascade; opportunities are kept. */
export async function deleteTag(db: Db, userId: string, rawId: unknown): Promise<ActionResult> {
  const id = uuid.safeParse(rawId);
  if (!id.success) return NOT_FOUND;
  const { data, error } = await db
    .from("tags")
    .delete()
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("id");
  if (error) return dbFailure(error, "delete tag");
  return data.length ? ok() : NOT_FOUND;
}

export async function assignTag(
  db: Db,
  userId: string,
  rawOpportunityId: unknown,
  rawTagId: unknown,
): Promise<ActionResult> {
  const opportunityId = uuid.safeParse(rawOpportunityId);
  const tagId = uuid.safeParse(rawTagId);
  if (!opportunityId.success || !tagId.success) return NOT_FOUND;

  const { error } = await db
    .from("opportunity_tags")
    .upsert(
      { opportunity_id: opportunityId.data, tag_id: tagId.data, user_id: userId },
      { onConflict: "opportunity_id,tag_id", ignoreDuplicates: true },
    );
  if (error) return dbFailure(error, "assign tag");
  return ok();
}

export async function unassignTag(
  db: Db,
  userId: string,
  rawOpportunityId: unknown,
  rawTagId: unknown,
): Promise<ActionResult> {
  const opportunityId = uuid.safeParse(rawOpportunityId);
  const tagId = uuid.safeParse(rawTagId);
  if (!opportunityId.success || !tagId.success) return NOT_FOUND;

  const { error } = await db
    .from("opportunity_tags")
    .delete()
    .eq("opportunity_id", opportunityId.data)
    .eq("tag_id", tagId.data)
    .eq("user_id", userId);
  if (error) return dbFailure(error, "unassign tag");
  return ok();
}

/**
 * Assigns the tag called `name`, creating it first if needed. An existing tag
 * is matched case-insensitively, so typing "cybersecurity" reuses
 * "Cybersecurity" instead of failing.
 */
export async function assignTagByName(
  db: Db,
  userId: string,
  rawOpportunityId: unknown,
  rawName: unknown,
): Promise<ActionResult<{ tagId: string }>> {
  const name = tagNameSchema.safeParse(rawName);
  if (!name.success) return validationFailed(name.error);

  const found = await findByName(db, userId, name.data);
  if (found.error) return dbFailure(found.error, "load tags");

  let tagId = found.tag?.id;
  if (!tagId) {
    const created = await createTag(db, userId, { name: name.data, color: nextColor(found.all) });
    if (!created.ok) return created;
    tagId = created.data.id;
  }

  const assigned = await assignTag(db, userId, rawOpportunityId, tagId);
  return assigned.ok ? ok({ tagId }) : assigned;
}
