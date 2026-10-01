"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import * as service from "@/server/services/tags";

function refresh() {
  revalidatePath("/");
  revalidatePath("/tags");
}

export async function createTagAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
) {
  const { supabase, userId } = await requireUser();
  const result = await service.createTag(supabase, userId, {
    name: formData.get("name"),
    color: formData.get("color") || undefined,
  });
  if (result.ok) refresh();
  return result;
}

export async function updateTagAction(id: string, input: { name?: string; color?: string }) {
  const { supabase, userId } = await requireUser();
  const result = await service.updateTag(supabase, userId, id, input);
  if (result.ok) refresh();
  return result;
}

export async function deleteTagAction(id: string) {
  const { supabase, userId } = await requireUser();
  const result = await service.deleteTag(supabase, userId, id);
  if (result.ok) refresh();
  return result;
}

export async function assignTagAction(opportunityId: string, tagId: string) {
  const { supabase, userId } = await requireUser();
  const result = await service.assignTag(supabase, userId, opportunityId, tagId);
  if (result.ok) refresh();
  return result;
}

export async function unassignTagAction(opportunityId: string, tagId: string) {
  const { supabase, userId } = await requireUser();
  const result = await service.unassignTag(supabase, userId, opportunityId, tagId);
  if (result.ok) refresh();
  return result;
}

export async function assignTagByNameAction(opportunityId: string, name: string) {
  const { supabase, userId } = await requireUser();
  const result = await service.assignTagByName(supabase, userId, opportunityId, name);
  if (result.ok) refresh();
  return result;
}
