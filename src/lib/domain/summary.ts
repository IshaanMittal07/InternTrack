import {
  LINKEDIN_CONNECTIONS,
  OUTREACH_STATUSES,
  type LinkedinConnection,
  type OutreachStatus,
} from "./constants";
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

/** How many contacts are at each message status, skipping statuses with none. */
export function outreachCounts(
  contacts: { outreach_status: OutreachStatus }[],
): { status: OutreachStatus; count: number }[] {
  return OUTREACH_STATUSES.map((status) => ({
    status,
    count: contacts.filter((c) => c.outreach_status === status).length,
  })).filter((s) => s.count > 0);
}

type LinkedinFields = {
  linkedin_connection: LinkedinConnection | null;
  outreach_status: OutreachStatus;
};

/**
 * The contact's LinkedIn connection status, or null once a message has been
 * sent: from then on the message status is what matters, so the LinkedIn
 * tag goes away.
 */
export function activeLinkedinConnection(contact: LinkedinFields): LinkedinConnection | null {
  return contact.outreach_status === "not_sent" ? contact.linkedin_connection : null;
}

/** How many contacts are at each LinkedIn connection status, skipping empty ones. */
export function linkedinCounts(
  contacts: LinkedinFields[],
): { status: LinkedinConnection; count: number }[] {
  return LINKEDIN_CONNECTIONS.map((status) => ({
    status,
    count: contacts.filter((c) => activeLinkedinConnection(c) === status).length,
  })).filter((s) => s.count > 0);
}
