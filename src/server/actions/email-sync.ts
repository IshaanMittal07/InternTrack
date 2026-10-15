"use server";

import { revalidatePath } from "next/cache";

import { fail, GENERIC_ERROR, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { microsoftConfig } from "@/lib/email/config";
import { env } from "@/lib/env";
import * as service from "@/server/services/email-sync";

function revalidate() {
  revalidatePath("/email");
  revalidatePath("/");
}

export async function createSyncKeyAction(): Promise<ActionResult<{ key: string }>> {
  const { supabase } = await requireUser();
  const result = await service.createSyncKey(supabase);
  if (result.ok) revalidatePath("/email");
  return result;
}

export async function deleteSyncKeyAction(): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const result = await service.deleteSyncKey(supabase);
  if (result.ok) revalidatePath("/email");
  return result;
}

export async function disconnectMailboxAction(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const result = await service.deleteConnection(supabase, id);
  if (result.ok) revalidatePath("/email");
  return result;
}

export async function undoEmailRejectionAction(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const result = await service.undoRejection(supabase, id);
  if (result.ok) revalidate();
  return result;
}

/** Checks the connected Microsoft mailboxes right away. */
export async function checkMailboxesNowAction(): Promise<ActionResult<{ message: string }>> {
  const { supabase } = await requireUser();
  const config = microsoftConfig();
  if (!config) return fail("Outlook sync isn't set up on the server yet.");

  let results;
  try {
    results = await service.syncMicrosoft(supabase, undefined, config, env().APP_TIMEZONE, {
      force: true,
    });
  } catch (error) {
    console.error("[email-sync] manual check failed", error);
    return fail(GENERIC_ERROR);
  }
  revalidate();

  if (results.length === 0) return fail("Connect a mailbox first.");
  if (results.some((r) => !r.ok))
    return fail("A mailbox couldn't be checked. See its status below.");
  const rejected = results.reduce((n, r) => n + (r.summary?.rejected ?? 0), 0);
  const review = results.reduce((n, r) => n + (r.summary?.needsReview ?? 0), 0);
  const parts = [
    rejected === 1 ? "1 application marked Rejected" : `${rejected} applications marked Rejected`,
    ...(review > 0 ? [`${review} to review below`] : []),
  ];
  return ok({ message: `Checked. ${parts.join(", ")}.` });
}
