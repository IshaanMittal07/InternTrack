import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;

export type Opportunity = Tables<"opportunities">;
export type Contact = Tables<"contacts">;
export type Tag = Tables<"tags">;
export type JobBoard = Tables<"job_boards">;

/** An opportunity with its contacts and the ids of its tags. */
export type OpportunityWithRelations = Opportunity & {
  contacts: Contact[];
  tagIds: string[];
};

export type TagWithUsage = Tag & { usage: number };
