import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  deadlineLabel,
  deadlineStatus,
  formatDate,
  isDeadlineHighlighted,
  isFollowUpDueThisWeek,
  isFollowUpOverdue,
  isIsoDate,
  isUpcomingDeadline,
  todayIn,
} from "@/lib/domain/dates";

const today = "2026-10-01";

describe("isIsoDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2026-04-31")).toBe(false);
    expect(isIsoDate("2026-1-1")).toBe(false);
  });
});

describe("todayIn", () => {
  // 2026-10-01 03:30 UTC is still Sept 30 in Toronto (UTC-4).
  const now = new Date("2026-10-01T03:30:00Z");

  it("uses the configured time zone, not the server's", () => {
    expect(todayIn("UTC", now)).toBe("2026-10-01");
    expect(todayIn("America/Toronto", now)).toBe("2026-09-30");
    expect(todayIn("Asia/Kolkata", now)).toBe("2026-10-01");
  });
});

describe("addDays / daysBetween", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2026-10-05", "2026-10-01")).toBe(-4);
  });

  it("is not thrown off by daylight saving changes", () => {
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });
});

describe("deadline highlighting (within 7 days)", () => {
  it.each([
    [null, null],
    ["2026-09-30", "overdue"],
    ["2026-10-01", "today"],
    ["2026-10-02", "soon"],
    ["2026-10-08", "soon"],
    ["2026-10-09", "later"],
  ] as const)("%s is %s", (deadline, status) => {
    expect(deadlineStatus(deadline, today)).toBe(status);
  });

  it("highlights only today through the next 7 days", () => {
    expect(isDeadlineHighlighted("2026-10-08", today)).toBe(true);
    expect(isDeadlineHighlighted("2026-10-09", today)).toBe(false);
    expect(isDeadlineHighlighted("2026-09-30", today)).toBe(false);
    expect(isDeadlineHighlighted(null, today)).toBe(false);
  });

  it("labels deadlines in plain language", () => {
    expect(deadlineLabel("2026-10-01", today)).toBe("Due today");
    expect(deadlineLabel("2026-10-02", today)).toBe("Due tomorrow");
    expect(deadlineLabel("2026-10-06", today)).toBe("Due in 5 days");
    expect(deadlineLabel("2026-10-20", today)).toBe("Due Oct 20, 2026");
    expect(deadlineLabel("2026-09-20", today)).toBe("Deadline passed Sep 20, 2026");
  });
});

describe("follow-ups", () => {
  it("is overdue only strictly before today", () => {
    expect(isFollowUpOverdue("2026-09-30", today)).toBe(true);
    expect(isFollowUpOverdue("2026-10-01", today)).toBe(false);
    expect(isFollowUpOverdue(null, today)).toBe(false);
  });

  it("is due this week when overdue or within the next 7 days", () => {
    expect(isFollowUpDueThisWeek("2026-09-01", today)).toBe(true);
    expect(isFollowUpDueThisWeek("2026-10-07", today)).toBe(true);
    expect(isFollowUpDueThisWeek("2026-10-08", today)).toBe(false);
    expect(isFollowUpDueThisWeek(null, today)).toBe(false);
  });
});

describe("upcoming deadlines (next 14 days)", () => {
  it("includes today through 14 days out, excluding past", () => {
    expect(isUpcomingDeadline("2026-10-01", today)).toBe(true);
    expect(isUpcomingDeadline("2026-10-15", today)).toBe(true);
    expect(isUpcomingDeadline("2026-10-16", today)).toBe(false);
    expect(isUpcomingDeadline("2026-09-30", today)).toBe(false);
  });
});

describe("formatDate", () => {
  it("formats without shifting the day", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026");
  });
});
