"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import * as service from "@/server/services/job-boards";

export async function createJobBoardAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
) {
  const { supabase, userId } = await requireUser();
  const result = await service.createJobBoard(supabase, userId, {
    name: formData.get("name"),
    url: formData.get("url"),
  });
  if (result.ok) revalidatePath("/");
  return result;
}

export async function deleteJobBoardAction(id: string) {
  const { supabase, userId } = await requireUser();
  const result = await service.deleteJobBoard(supabase, userId, id);
  if (result.ok) revalidatePath("/");
  return result;
}
