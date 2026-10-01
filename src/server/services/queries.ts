import type { Db, OpportunityWithRelations, TagWithUsage } from "@/lib/domain/types";

/** All of the user's opportunities with contacts and tag ids. */
export async function listOpportunities(
  db: Db,
  userId: string,
): Promise<OpportunityWithRelations[]> {
  const { data, error } = await db
    .from("opportunities")
    .select("*, contacts!contacts_opportunity_id_fkey(*), opportunity_tags(tag_id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("created_at", { ascending: true, referencedTable: "contacts" });
  if (error) throw new Error(`Failed to load opportunities: ${error.message}`);

  return data.map(({ opportunity_tags, contacts, ...opportunity }) => ({
    ...opportunity,
    contacts,
    tagIds: opportunity_tags.map((t) => t.tag_id),
  }));
}

/** All of the user's tags, alphabetically, with how many opportunities use each. */
export async function listTags(db: Db, userId: string): Promise<TagWithUsage[]> {
  const { data, error } = await db
    .from("tags")
    .select("*, opportunity_tags(count)")
    .eq("user_id", userId)
    .order("name");
  if (error) throw new Error(`Failed to load tags: ${error.message}`);

  return data
    .map(({ opportunity_tags, ...tag }) => ({ ...tag, usage: opportunity_tags[0]?.count ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
