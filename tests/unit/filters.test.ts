import { describe, expect, it } from "vitest";

import {
  DEFAULT_FILTERS,
  applyFilters,
  countByCategory,
  filtersToQuery,
  hasActiveFilters,
  parseFilters,
  type Filters,
} from "@/lib/domain/filters";

import { makeContact, makeOpportunity } from "./fixtures";

const TAG_A = "11111111-1111-4111-8111-111111111111";
const TAG_B = "22222222-2222-4222-8222-222222222222";
const TAG_C = "33333333-3333-4333-8333-333333333333";

const f = (overrides: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...overrides });

const opps = [
  makeOpportunity({
    company: "Quantinuum",
    role_title: "Quantum Software Intern",
    category: "applied",
    date_applied: "2026-09-01",
    application_stage: "interviewing",
    referral_status: "received",
    priority: "high",
    deadline: "2026-10-20",
    tagIds: [TAG_A],
    contacts: [makeContact({ outreach_status: "replied" }), makeContact()],
    created_at: "2026-09-01T00:00:00Z",
  }),
  makeOpportunity({
    company: "CrowdStrike",
    role_title: "Security Engineering Intern",
    category: "applied",
    date_applied: "2026-09-03",
    application_stage: "submitted",
    priority: "low",
    deadline: "2026-10-05",
    tagIds: [TAG_B],
    contacts: [
      makeContact({ outreach_status: "sent" }),
      makeContact({ linkedin_connection: "sent" }),
    ],
    created_at: "2026-09-03T00:00:00Z",
  }),
  makeOpportunity({
    company: "Nvidia",
    role_title: "Hardware Intern",
    category: "applied",
    date_applied: "2026-09-02",
    application_stage: "submitted",
    priority: "medium",
    deadline: null,
    tagIds: [TAG_A, TAG_C],
    created_at: "2026-09-02T00:00:00Z",
  }),
  makeOpportunity({ company: "Planned Co", category: "planning", tagIds: [TAG_A] }),
];

describe("parseFilters", () => {
  it("returns defaults for empty or invalid params", () => {
    expect(parseFilters({})).toEqual(DEFAULT_FILTERS);
    expect(
      parseFilters({
        tab: "nope",
        sort: "random",
        stage: "hired",
        tags: "not-a-uuid",
        priority: "x",
        outreach: "ghosted",
        linkedin: "maybe",
      }),
    ).toEqual(DEFAULT_FILTERS);
  });

  it("reads every filter", () => {
    expect(
      parseFilters({
        tab: "applied",
        q: "  quant ",
        stage: "interviewing",
        referral: "received",
        priority: "high",
        outreach: "replied",
        linkedin: "sent",
        tags: `${TAG_A},${TAG_B},${TAG_A}`,
        sort: "deadline",
      }),
    ).toEqual({
      tab: "applied",
      q: "quant",
      stage: "interviewing",
      referral: "received",
      priority: "high",
      outreach: "replied",
      linkedin: "sent",
      tags: [TAG_A, TAG_B],
      sort: "deadline",
    });
  });

  it("ignores stage outside the Applied tab", () => {
    expect(parseFilters({ tab: "planning", stage: "interviewing" }).stage).toBeNull();
  });

  it("round-trips through filtersToQuery", () => {
    const filters = f({
      tab: "applied",
      q: "a b",
      outreach: "sent",
      linkedin: "not_sent",
      tags: [TAG_A, TAG_B],
      sort: "priority",
    });
    const query = filtersToQuery(filters);
    expect(parseFilters(Object.fromEntries(new URLSearchParams(query)))).toEqual(filters);
  });
});

describe("applyFilters", () => {
  const names = (filters: Filters) => applyFilters(opps, filters).map((o) => o.company);

  it("shows only the current tab", () => {
    expect(names(f({ tab: "planning" }))).toEqual(["Planned Co"]);
  });

  it("searches company and role, case-insensitively", () => {
    expect(names(f({ q: "QUANT" }))).toEqual(["Quantinuum"]);
    expect(names(f({ q: "security" }))).toEqual(["CrowdStrike"]);
  });

  it("filters by stage, referral and priority", () => {
    expect(names(f({ stage: "submitted" })).sort()).toEqual(["CrowdStrike", "Nvidia"]);
    expect(names(f({ referral: "received" }))).toEqual(["Quantinuum"]);
    expect(names(f({ priority: "low" }))).toEqual(["CrowdStrike"]);
  });

  it("filters by message status on ANY contact", () => {
    expect(names(f({ outreach: "replied" }))).toEqual(["Quantinuum"]);
    expect(names(f({ outreach: "sent" }))).toEqual(["CrowdStrike"]);
    expect(names(f({ outreach: "not_sent" }))).toEqual(["CrowdStrike", "Quantinuum"]);
    expect(names(f({ outreach: "read" }))).toEqual([]);
  });

  it("filters by LinkedIn connection, ignoring contacts already messaged", () => {
    expect(names(f({ linkedin: "sent" }))).toEqual(["CrowdStrike"]);
    // CrowdStrike's only un-messaged contact has a request sent; Quantinuum's
    // un-messaged contact doesn't, and its messaged contact no longer counts.
    expect(names(f({ linkedin: "not_sent" }))).toEqual(["Quantinuum"]);
    expect(hasActiveFilters(f({ linkedin: "sent" }))).toBe(true);
  });

  it("matches ANY selected tag", () => {
    expect(names(f({ tags: [TAG_C] }))).toEqual(["Nvidia"]);
    expect(names(f({ tags: [TAG_B, TAG_C] })).sort()).toEqual(["CrowdStrike", "Nvidia"]);
  });

  it("combines all filters together", () => {
    expect(names(f({ tags: [TAG_A], stage: "submitted" }))).toEqual(["Nvidia"]);
    expect(names(f({ tags: [TAG_A], q: "crowd" }))).toEqual([]);
  });

  it("sorts by date added (newest first) by default", () => {
    expect(names(f({}))).toEqual(["CrowdStrike", "Nvidia", "Quantinuum"]);
  });

  it("sorts by deadline with missing deadlines last", () => {
    expect(names(f({ sort: "deadline" }))).toEqual(["CrowdStrike", "Quantinuum", "Nvidia"]);
  });

  it("sorts by priority, high first", () => {
    expect(names(f({ sort: "priority" }))).toEqual(["Quantinuum", "Nvidia", "CrowdStrike"]);
  });

  it("does not mutate its input", () => {
    const before = opps.map((o) => o.id);
    applyFilters(opps, f({ sort: "priority" }));
    expect(opps.map((o) => o.id)).toEqual(before);
  });
});

describe("helpers", () => {
  it("counts per category", () => {
    expect(countByCategory(opps)).toEqual({ applied: 3, planning: 1, interested: 0 });
  });

  it("knows when filters are active (sort and tab don't count)", () => {
    expect(hasActiveFilters(f({ sort: "deadline", tab: "planning" }))).toBe(false);
    expect(hasActiveFilters(f({ tags: [TAG_A] }))).toBe(true);
    expect(hasActiveFilters(f({ outreach: "read" }))).toBe(true);
  });
});
