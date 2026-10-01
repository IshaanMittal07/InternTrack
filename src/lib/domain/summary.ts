import { isFollowUpDueThisWeek, isUpcomingDeadline } from "./dates";
import type { OpportunityWithRelations, Tag } from "./types";

export type Summary = {
  totalApplied: number;
  interviewsInProgress: number;
  referralsReceived: number;
  followUpsDueThisWeek: number;
  upcomingDeadlines: number;
  tagCounts: { id: string; name: string; color: Tag["color"]; count: number }[];
};

/**
 * Numbers for the summary strip.
 * - Interviews in progress: applications at the "interviewing" stage.
 * - Follow-ups due this week: contacts whose next follow-up is overdue or
 *   within the next 7 days (today included).
 * - Upcoming deadlines: Planning/Interested opportunities with a deadline in
 *   the next 14 days (once applied, a deadline no longer needs attention).
 */
export function computeSummary(
  opportunities: OpportunityWithRelations[],
  tags: Pick<Tag, "id" | "name" | "color">[],
  today: string,
): Summary {
  let totalApplied = 0;
  let interviewsInProgress = 0;
  let referralsReceived = 0;
  let followUpsDueThisWeek = 0;
  let upcomingDeadlines = 0;
  const perTag = new Map<string, number>();

  for (const o of opportunities) {
    if (o.category === "applied") totalApplied += 1;
    if (o.application_stage === "interviewing") interviewsInProgress += 1;
    if (o.referral_status === "received") referralsReceived += 1;
    if (o.category !== "applied" && isUpcomingDeadline(o.deadline, today)) upcomingDeadlines += 1;
    for (const c of o.contacts) {
      if (isFollowUpDueThisWeek(c.next_follow_up, today)) followUpsDueThisWeek += 1;
    }
    for (const id of o.tagIds) perTag.set(id, (perTag.get(id) ?? 0) + 1);
  }

  return {
    totalApplied,
    interviewsInProgress,
    referralsReceived,
    followUpsDueThisWeek,
    upcomingDeadlines,
    tagCounts: tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      count: perTag.get(t.id) ?? 0,
    })),
  };
}

/** "2 of 3 contacts spoken to". */
export function contactProgress(contacts: { has_spoken: boolean }[]): string | null {
  if (contacts.length === 0) return null;
  const spoken = contacts.filter((c) => c.has_spoken).length;
  return `${spoken} of ${contacts.length} ${contacts.length === 1 ? "contact" : "contacts"} spoken to`;
}
