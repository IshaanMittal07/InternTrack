"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { todayIn } from "@/lib/domain/dates";
import { env } from "@/lib/env";
import * as service from "@/server/services/opportunities";
import { fetchPostingDetails } from "@/server/services/posting-import";
import { quickSavePosting } from "@/server/services/quick-save";

/*
 * Server Actions are public HTTP endpoints, so each one re-verifies the
 * session (requireUser) before the service validates input with Zod.
 */

export async function createOpportunityAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
) {
  const { supabase, userId } = await requireUser();
  const result = await service.createOpportunity(supabase, userId, formData);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function updateOpportunityAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
) {
  const { supabase, userId } = await requireUser();
  const result = await service.updateOpportunity(supabase, userId, id, formData);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function deleteOpportunityAction(id: string) {
  const { supabase, userId } = await requireUser();
  const result = await service.deleteOpportunity(supabase, userId, id);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function moveOpportunityAction(input: {
  id: string;
  to: string;
  date_applied?: string;
}) {
  const { supabase, userId } = await requireUser();
  const today = todayIn(env().APP_TIMEZONE);
  const result = await service.moveOpportunity(supabase, userId, input, today);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function setReferralAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
) {
  const { supabase, userId } = await requireUser();
  const result = await service.setReferral(supabase, userId, id, formData);
  if (result.ok) revalidatePath("/");
  return result;
}

/** Saves the job page the "Save to tracker" bookmark was clicked on, as applied today. */
export async function quickSavePostingAction(input: {
  url: string;
  company?: string;
  role?: string;
  title?: string;
}) {
  const { supabase, userId } = await requireUser();
  const today = todayIn(env().APP_TIMEZONE);
  const result = await quickSavePosting(supabase, userId, input, today, fetchPostingDetails);
  if (result.ok) revalidatePath("/");
  return result;
}
