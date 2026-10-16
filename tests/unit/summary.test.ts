import { describe, expect, it } from "vitest";

import {
  activeLinkedinConnection,
  computeSummary,
  contactProgress,
  highlightCounts,
  outreachCounts,
  postingHighlight,
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

describe("activeLinkedinConnection", () => {
  it("shows the posting's status while no contact has been messaged", () => {
    expect(activeLinkedinConnection({ linkedin_connection: "sent", contacts: [] })).toBe("sent");
    expect(
      activeLinkedinConnection({
        linkedin_connection: "not_sent",
        contacts: [{ outreach_status: "not_sent" }],
      }),
    ).toBe("not_sent");
    expect(activeLinkedinConnection({ linkedin_connection: null, contacts: [] })).toBeNull();
  });

  it("removes the tag once any contact has been messaged", () => {
    for (const outreach_status of ["sent", "read", "replied"] as const) {
      expect(
        activeLinkedinConnection({
          linkedin_connection: "sent",
          contacts: [{ outreach_status: "not_sent" }, { outreach_status }],
        }),
      ).toBeNull();
    }
  });
});

describe("postingHighlight", () => {
  type C = { has_spoken: boolean; outreach_status: "not_sent" | "sent" | "read" | "replied" };
  const contact = (over: Partial<C> = {}): C => ({
    has_spoken: false,
    outreach_status: "not_sent",
    ...over,
  });
  const base = {
    application_stage: null,
    linkedin_connection: null,
    contacts: [] as C[],
  };

  it("is null when nothing applies", () => {
    expect(postingHighlight(base)).toBeNull();
    expect(postingHighlight({ ...base, contacts: [contact()] })).toBeNull();
  });

  it("follows the LinkedIn connection status", () => {
    expect(postingHighlight({ ...base, linkedin_connection: "not_sent" })).toBe(
      "connection_unsent",
    );
    expect(postingHighlight({ ...base, linkedin_connection: "sent" })).toBe("connection_sent");
    expect(postingHighlight({ ...base, linkedin_connection: "sent", contacts: [contact()] })).toBe(
      "connection_sent",
    );
  });

  it("prefers a message sent over the connection status", () => {
    for (const outreach_status of ["sent", "read", "replied"] as const) {
      for (const linkedin_connection of [null, "not_sent", "sent"] as const) {
        expect(
          postingHighlight({
            ...base,
            linkedin_connection,
            contacts: [contact(), contact({ outreach_status })],
          }),
        ).toBe("messaged_some");
        expect(
          postingHighlight({
            ...base,
            linkedin_connection,
            contacts: [contact({ outreach_status }), contact({ outreach_status: "sent" })],
          }),
        ).toBe("messaged");
      }
    }
  });

  it("is light blue for some contacts messaged and blue for all of them", () => {
    const sent = contact({ outreach_status: "sent" });
    expect(postingHighlight({ ...base, contacts: [sent] })).toBe("messaged");
    expect(postingHighlight({ ...base, contacts: [sent, contact()] })).toBe("messaged_some");
    expect(postingHighlight({ ...base, contacts: [sent, contact(), contact()] })).toBe(
      "messaged_some",
    );
    expect(
      postingHighlight({
        ...base,
        contacts: [
          sent,
          contact({ outreach_status: "read" }),
          contact({ outreach_status: "replied" }),
        ],
      }),
    ).toBe("messaged");
  });

  it("prefers a contact spoken to over messages and the connection status", () => {
    expect(
      postingHighlight({
        ...base,
        linkedin_connection: "sent",
        contacts: [contact({ outreach_status: "replied" }), contact({ has_spoken: true })],
      }),
    ).toBe("spoken");
  });

  it("marks rejections above everything else", () => {
    expect(
      postingHighlight({
        application_stage: "rejected",
        linkedin_connection: "sent",
        contacts: [contact({ has_spoken: true, outreach_status: "replied" })],
      }),
    ).toBe("rejected");
    expect(postingHighlight({ ...base, application_stage: "withdrawn" })).toBeNull();
  });
});

describe("highlightCounts", () => {
  it("counts each outline color within one category", () => {
    const opportunities = [
      makeOpportunity({
        category: "applied",
        date_applied: "2026-09-01",
        application_stage: "rejected",
      }),
      makeOpportunity({
        category: "applied",
        date_applied: "2026-09-01",
        application_stage: "submitted",
        linkedin_connection: "sent",
      }),
      makeOpportunity({
        category: "applied",
        date_applied: "2026-09-01",
        application_stage: "submitted",
        linkedin_connection: "sent",
      }),
      makeOpportunity({
        category: "applied",
        date_applied: "2026-09-01",
        application_stage: "submitted",
        contacts: [makeContact({ has_spoken: true })],
      }),
      makeOpportunity({
        category: "applied",
        date_applied: "2026-09-01",
        application_stage: "submitted",
      }),
      makeOpportunity({ category: "planning", linkedin_connection: "not_sent" }),
    ];
    expect(highlightCounts(opportunities, "applied")).toEqual({
      rejected: 1,
      connection_unsent: 0,
      connection_sent: 2,
      messaged_some: 0,
      messaged: 0,
      spoken: 1,
    });
    expect(highlightCounts(opportunities, "planning").connection_unsent).toBe(1);
  });
});
