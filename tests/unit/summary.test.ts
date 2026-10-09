import { describe, expect, it } from "vitest";

import {
  activeLinkedinConnection,
  computeSummary,
  contactProgress,
  linkedinCounts,
  outreachCounts,
} from "@/lib/domain/summary";

import { makeContact, makeOpportunity } from "./fixtures";

const today = "2026-10-01";
const tags = [
  { id: "t1", name: "Cybersecurity", color: "terracotta" as const },
  { id: "t2", name: "Quantum", color: "plum" as const },
  { id: "t3", name: "Hardware", color: "slate" as const },
];

describe("computeSummary", () => {
  const summary = computeSummary(
    [
      makeOpportunity({
        category: "applied",
        date_applied: "2026-09-01",
        application_stage: "interviewing",
        referral_status: "received",
        deadline: "2026-10-03", // applied: deadline no longer counts
        tagIds: ["t1", "t2"],
        contacts: [
          makeContact({ next_follow_up: "2026-09-25" }), // overdue -> due this week
          makeContact({ next_follow_up: "2026-10-07" }), // within 7 days
          makeContact({ next_follow_up: "2026-10-08" }), // next week
        ],
      }),
      makeOpportunity({
        category: "applied",
        date_applied: "2026-09-02",
        application_stage: "submitted",
        tagIds: ["t1"],
      }),
      makeOpportunity({ category: "planning", deadline: "2026-10-15", tagIds: ["t1"] }),
      makeOpportunity({ category: "planning", deadline: "2026-10-16" }),
      makeOpportunity({ category: "interested", deadline: "2026-09-30" }),
      makeOpportunity({ category: "interested", referral_status: "received" }),
    ],
    tags,
    today,
  );

  it("counts applications, interviews and referrals", () => {
    expect(summary.totalApplied).toBe(2);
    expect(summary.interviewsInProgress).toBe(1);
    expect(summary.referralsReceived).toBe(2);
  });

  it("counts follow-ups due this week, including overdue", () => {
    expect(summary.followUpsDueThisWeek).toBe(2);
  });

  it("counts non-applied deadlines in the next 14 days", () => {
    expect(summary.upcomingDeadlines).toBe(1);
  });

  it("counts opportunities per tag, including unused tags", () => {
    expect(summary.tagCounts.map((t) => [t.name, t.count])).toEqual([
      ["Cybersecurity", 3],
      ["Quantum", 1],
      ["Hardware", 0],
    ]);
  });
});

describe("contactProgress", () => {
  it("describes how many contacts were spoken to", () => {
    expect(contactProgress([])).toBeNull();
    expect(contactProgress([{ has_spoken: true }])).toBe("1 of 1 contact spoken to");
    expect(
      contactProgress([{ has_spoken: true }, { has_spoken: false }, { has_spoken: true }]),
    ).toBe("2 of 3 contacts spoken to");
  });
});

describe("outreachCounts", () => {
  it("counts contacts per message status in order, skipping empty ones", () => {
    expect(outreachCounts([])).toEqual([]);
    expect(
      outreachCounts([
        { outreach_status: "replied" },
        { outreach_status: "not_sent" },
        { outreach_status: "replied" },
      ]),
    ).toEqual([
      { status: "not_sent", count: 1 },
      { status: "replied", count: 2 },
    ]);
  });
});

describe("LinkedIn connections", () => {
  it("only applies while no message has been sent", () => {
    expect(
      activeLinkedinConnection({ linkedin_connection: "sent", outreach_status: "not_sent" }),
    ).toBe("sent");
    for (const outreach_status of ["sent", "read", "replied"] as const) {
      expect(activeLinkedinConnection({ linkedin_connection: "sent", outreach_status })).toBeNull();
    }
    expect(
      activeLinkedinConnection({ linkedin_connection: null, outreach_status: "not_sent" }),
    ).toBeNull();
  });

  it("counts contacts per connection status, ignoring messaged contacts", () => {
    expect(
      linkedinCounts([
        { linkedin_connection: "sent", outreach_status: "not_sent" },
        { linkedin_connection: "sent", outreach_status: "replied" },
        { linkedin_connection: "not_sent", outreach_status: "not_sent" },
        { linkedin_connection: "sent", outreach_status: "not_sent" },
      ]),
    ).toEqual([
      { status: "not_sent", count: 1 },
      { status: "sent", count: 2 },
    ]);
  });
});
