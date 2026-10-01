/**
 * Date logic. All dates are calendar dates as "YYYY-MM-DD" strings, and
 * "today" is computed in the configured APP_TIMEZONE, so a deadline doesn't
 * flip a day early or late depending on where the server runs.
 */

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Today's date in `timeZone`. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

const DAY = 86_400_000;

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY);
}

export type DeadlineStatus = "overdue" | "today" | "soon" | "later";

/** "soon" means within the next 7 days. */
export function deadlineStatus(deadline: string | null, today: string): DeadlineStatus | null {
  if (!deadline) return null;
  const days = daysBetween(today, deadline);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "later";
}

export function isDeadlineHighlighted(deadline: string | null, today: string): boolean {
  const status = deadlineStatus(deadline, today);
  return status === "today" || status === "soon";
}

export function deadlineLabel(deadline: string, today: string): string {
  const days = daysBetween(today, deadline);
  if (days < 0) return `Deadline passed ${formatDate(deadline)}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days} days`;
  return `Due ${formatDate(deadline)}`;
}

export function isFollowUpOverdue(nextFollowUp: string | null, today: string): boolean {
  return nextFollowUp !== null && nextFollowUp < today;
}

/** Due this week = overdue, or due today through the next 6 days. */
export function isFollowUpDueThisWeek(nextFollowUp: string | null, today: string): boolean {
  return nextFollowUp !== null && nextFollowUp <= addDays(today, 6);
}

/** Deadline from today through the next 14 days. */
export function isUpcomingDeadline(deadline: string | null, today: string): boolean {
  return deadline !== null && deadline >= today && deadline <= addDays(today, 14);
}

/** "Oct 12, 2026". */
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(toUtc(date)));
}
