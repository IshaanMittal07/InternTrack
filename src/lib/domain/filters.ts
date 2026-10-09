import { z } from "zod";

import {
  CATEGORIES,
  OUTREACH_STATUSES,
  PRIORITIES,
  PRIORITY_RANK,
  REFERRAL_STATUSES,
  STAGES,
  type Category,
  type OutreachStatus,
  type Priority,
  type ReferralStatus,
  type Stage,
} from "./constants";
import type { OpportunityWithRelations } from "./types";

export const SORT_KEYS = ["added", "deadline", "priority"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const SORT_LABELS: Record<SortKey, string> = {
  added: "Date added",
  deadline: "Deadline",
  priority: "Priority",
};

export type Filters = {
  tab: Category;
  q: string;
  stage: Stage | null;
  referral: ReferralStatus | null;
  priority: Priority | null;
  outreach: OutreachStatus | null;
  tags: string[];
  sort: SortKey;
};

export const DEFAULT_FILTERS: Filters = {
  tab: "applied",
  q: "",
  stage: null,
  referral: null,
  priority: null,
  outreach: null,
  tags: [],
  sort: "added",
};

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads filters from the URL. Anything invalid falls back to the default. */
const filtersSchema = z.object({
  tab: z.enum(CATEGORIES).catch(DEFAULT_FILTERS.tab),
  q: z.string().trim().max(100).catch(""),
  stage: z.enum(STAGES).nullable().catch(null),
  referral: z.enum(REFERRAL_STATUSES).nullable().catch(null),
  priority: z.enum(PRIORITIES).nullable().catch(null),
  outreach: z.enum(OUTREACH_STATUSES).nullable().catch(null),
  tags: z.array(z.uuid()).max(50).catch([]),
  sort: z.enum(SORT_KEYS).catch(DEFAULT_FILTERS.sort),
});

export function parseFilters(params: SearchParams): Filters {
  const rawTags = first(params.tags);
  const parsed = filtersSchema.parse({
    tab: first(params.tab),
    q: first(params.q) ?? "",
    stage: first(params.stage) ?? null,
    referral: first(params.referral) ?? null,
    priority: first(params.priority) ?? null,
    outreach: first(params.outreach) ?? null,
    tags: rawTags ? [...new Set(rawTags.split(",").filter(Boolean))] : [],
    sort: first(params.sort),
  });
  // Stages only exist on applications.
  return parsed.tab === "applied" ? parsed : { ...parsed, stage: null };
}

/** Builds a query string for `filters`, omitting defaults. */
export function filtersToQuery(filters: Filters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  params.set("tab", filters.tab);
  if (filters.q) params.set("q", filters.q);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.referral) params.set("referral", filters.referral);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.outreach) params.set("outreach", filters.outreach);
  if (filters.tags.length) params.set("tags", filters.tags.join(","));
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `?${params.toString()}`;
}

export function hasActiveFilters(filters: Filters): boolean {
  return Boolean(
    filters.q ||
    filters.stage ||
    filters.referral ||
    filters.priority ||
    filters.outreach ||
    filters.tags.length,
  );
}

function byDeadline(a: OpportunityWithRelations, b: OpportunityWithRelations): number {
  if (a.deadline === b.deadline) return 0;
  if (!a.deadline) return 1; // no deadline sorts last
  if (!b.deadline) return -1;
  return a.deadline < b.deadline ? -1 : 1;
}

function byAddedDesc(a: OpportunityWithRelations, b: OpportunityWithRelations): number {
  return b.created_at.localeCompare(a.created_at);
}

/**
 * Applies every filter together (AND), with tags matching ANY selected tag
 * and the message status matching ANY contact,
 * then sorts. Does not mutate the input.
 */
export function applyFilters(
  opportunities: OpportunityWithRelations[],
  filters: Filters,
): OpportunityWithRelations[] {
  const q = filters.q.toLowerCase();
  const selectedTags = new Set(filters.tags);

  const matches = opportunities.filter((o) => {
    if (o.category !== filters.tab) return false;
    if (q) {
      const haystack = `${o.company} ${o.role_title ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.stage && o.application_stage !== filters.stage) return false;
    if (filters.referral && o.referral_status !== filters.referral) return false;
    if (filters.priority && o.priority !== filters.priority) return false;
    // An opportunity matches when any of its contacts has that message status.
    if (filters.outreach && !o.contacts.some((c) => c.outreach_status === filters.outreach)) {
      return false;
    }
    if (selectedTags.size && !o.tagIds.some((id) => selectedTags.has(id))) return false;
    return true;
  });

  const sorters: Record<
    SortKey,
    (a: OpportunityWithRelations, b: OpportunityWithRelations) => number
  > = {
    added: byAddedDesc,
    deadline: (a, b) => byDeadline(a, b) || byAddedDesc(a, b),
    priority: (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      byDeadline(a, b) ||
      byAddedDesc(a, b),
  };

  return [...matches].sort(sorters[filters.sort]);
}

export function countByCategory(
  opportunities: OpportunityWithRelations[],
): Record<Category, number> {
  const counts: Record<Category, number> = { applied: 0, planning: 0, interested: 0 };
  for (const o of opportunities) counts[o.category] += 1;
  return counts;
}
