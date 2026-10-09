import { ok, validationFailed, type ActionResult } from "@/lib/action-result";
import type { Db, JobBoard } from "@/lib/domain/types";
import { uuid } from "@/lib/validation/common";
import { jobBoardSchema } from "@/lib/validation/job-board";

import { NOT_FOUND, dbFailure } from "./errors";

/** The user's saved job board links, oldest first. */
export async function listJobBoards(db: Db, userId: string): Promise<JobBoard[]> {
  const { data, error } = await db
    .from("job_boards")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw new Error(`Failed to load job boards: ${error.message}`);
  return data;
}

export async function createJobBoard(
  db: Db,
  userId: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = jobBoardSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);

  const { data, error } = await db
    .from("job_boards")
    .insert({ ...parsed.data, user_id: userId })
    .select("id")
    .single();
  if (error) return dbFailure(error, "create job board");
  return ok({ id: data.id });
}

export async function deleteJobBoard(
  db: Db,
  userId: string,
  rawId: unknown,
): Promise<ActionResult> {
  const id = uuid.safeParse(rawId);
  if (!id.success) return NOT_FOUND;
  const { data, error } = await db
    .from("job_boards")
    .delete()
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("id");
  if (error) return dbFailure(error, "delete job board");
  return data.length ? ok() : NOT_FOUND;
}
