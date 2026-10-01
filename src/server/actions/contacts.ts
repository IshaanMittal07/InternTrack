"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import * as service from "@/server/services/contacts";

export async function createContactAction(
  opportunityId: string,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
) {
  const { supabase, userId } = await requireUser();
  const result = await service.createContact(supabase, userId, opportunityId, formData);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function updateContactAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
) {
  const { supabase, userId } = await requireUser();
  const result = await service.updateContact(supabase, userId, id, formData);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function setContactSpokenAction(id: string, value: boolean) {
  const { supabase, userId } = await requireUser();
  const result = await service.setContactSpoken(supabase, userId, id, value);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function deleteContactAction(id: string) {
  const { supabase, userId } = await requireUser();
  const result = await service.deleteContact(supabase, userId, id);
  if (result.ok) revalidatePath("/");
  return result;
}
