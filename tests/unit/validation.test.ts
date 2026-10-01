import { describe, expect, it } from "vitest";

import { formToObject } from "@/lib/validation/common";
import { contactSchema } from "@/lib/validation/contact";
import { moveSchema, opportunitySchema, referralSchema } from "@/lib/validation/opportunity";
import { tagSchema, tagUpdateSchema } from "@/lib/validation/tag";

const UUID = "3f9a7c1e-2b4d-4e8f-9a1b-6c5d4e3f2a1b";

describe("opportunitySchema", () => {
  const base = { category: "planning", company: "Acme" };

  it("accepts a minimal opportunity and normalizes empty strings to null", () => {
    const result = opportunitySchema.parse({
      ...base,
      role_title: "",
      posting_url: "",
      deadline: "",
      notes: "  ",
    });
    expect(result).toMatchObject({
      category: "planning",
      company: "Acme",
      role_title: null,
      posting_url: null,
      deadline: null,
      notes: null,
      priority: "medium",
      date_applied: null,
      application_stage: null,
    });
  });

  it("trims text fields", () => {
    expect(opportunitySchema.parse({ ...base, company: "  Acme  " }).company).toBe("Acme");
  });

  it("requires a company of at most 120 characters", () => {
    expect(opportunitySchema.safeParse({ ...base, company: "   " }).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, company: "x".repeat(121) }).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, company: "x".repeat(120) }).success).toBe(true);
  });

  it("requires a category from the enum", () => {
    expect(opportunitySchema.safeParse({ ...base, category: "archived" }).success).toBe(false);
  });

  it("requires date applied for applied, defaulting the stage to submitted", () => {
    const missing = opportunitySchema.safeParse({ ...base, category: "applied" });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(["date_applied"]);

    const ok = opportunitySchema.parse({
      ...base,
      category: "applied",
      date_applied: "2026-09-15",
    });
    expect(ok.application_stage).toBe("submitted");
    expect(ok.date_applied).toBe("2026-09-15");
  });

  it("clears date applied and stage for non-applied categories", () => {
    const result = opportunitySchema.parse({
      ...base,
      category: "interested",
      date_applied: "2026-09-15",
      application_stage: "interviewing",
    });
    expect(result.date_applied).toBeNull();
    expect(result.application_stage).toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hi",
    "ftp://example.com",
    "example.com",
    "https://exa mple.com",
    "https://",
  ])("rejects posting URL %s", (posting_url) => {
    expect(opportunitySchema.safeParse({ ...base, posting_url }).success).toBe(false);
  });

  it.each(["https://jobs.example.com/123?ref=x", "http://example.com"])(
    "accepts posting URL %s",
    (posting_url) => {
      expect(opportunitySchema.parse({ ...base, posting_url }).posting_url).toBe(posting_url);
    },
  );

  it.each(["2026-02-30", "2026-13-01", "26-01-01", "tomorrow", "2026/01/01"])(
    "rejects invalid date %s",
    (deadline) => {
      expect(opportunitySchema.safeParse({ ...base, deadline }).success).toBe(false);
    },
  );

  it("rejects unknown stages and priorities", () => {
    expect(
      opportunitySchema.safeParse({
        ...base,
        category: "applied",
        date_applied: "2026-09-01",
        application_stage: "hired",
      }).success,
    ).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, priority: "urgent" }).success).toBe(false);
  });

  it("limits long text fields", () => {
    expect(opportunitySchema.safeParse({ ...base, notes: "x".repeat(20_001) }).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, term: "x".repeat(61) }).success).toBe(false);
  });
});

describe("moveSchema", () => {
  it("accepts a valid move", () => {
    expect(moveSchema.parse({ id: UUID, to: "applied", date_applied: "2026-09-01" })).toEqual({
      id: UUID,
      to: "applied",
      date_applied: "2026-09-01",
    });
  });

  it("rejects bad ids, categories and dates", () => {
    expect(moveSchema.safeParse({ id: "1", to: "applied" }).success).toBe(false);
    expect(moveSchema.safeParse({ id: UUID, to: "archived" }).success).toBe(false);
    expect(moveSchema.safeParse({ id: UUID, to: "applied", date_applied: "x" }).success).toBe(
      false,
    );
  });
});

describe("referralSchema", () => {
  it("accepts a status with or without a contact", () => {
    expect(
      referralSchema.parse({ referral_status: "received", referred_by_contact_id: "" }),
    ).toEqual({
      referral_status: "received",
      referred_by_contact_id: null,
    });
    expect(
      referralSchema.parse({ referral_status: "requested", referred_by_contact_id: UUID })
        .referred_by_contact_id,
    ).toBe(UUID);
  });

  it("rejects unknown statuses and malformed contact ids", () => {
    expect(referralSchema.safeParse({ referral_status: "maybe" }).success).toBe(false);
    expect(
      referralSchema.safeParse({ referral_status: "received", referred_by_contact_id: "abc" })
        .success,
    ).toBe(false);
  });
});

describe("contactSchema", () => {
  it("requires a name", () => {
    expect(contactSchema.safeParse({ name: "" }).success).toBe(false);
    expect(contactSchema.safeParse({ name: "x".repeat(121) }).success).toBe(false);
  });

  it("parses a full contact", () => {
    expect(
      contactSchema.parse({
        name: " Jane Doe ",
        title: "Recruiter",
        linkedin_url: "https://www.linkedin.com/in/jane",
        email: "Jane@Example.com",
        has_spoken: "on",
        last_contacted: "2026-09-01",
        next_follow_up: "2026-09-08",
        notes: "",
      }),
    ).toEqual({
      name: "Jane Doe",
      title: "Recruiter",
      linkedin_url: "https://www.linkedin.com/in/jane",
      email: "jane@example.com",
      has_spoken: true,
      last_contacted: "2026-09-01",
      next_follow_up: "2026-09-08",
      notes: null,
    });
  });

  it("treats a missing checkbox as not spoken", () => {
    expect(contactSchema.parse({ name: "A" }).has_spoken).toBe(false);
  });

  it("rejects invalid emails and links", () => {
    expect(contactSchema.safeParse({ name: "A", email: "nope" }).success).toBe(false);
    expect(contactSchema.safeParse({ name: "A", linkedin_url: "javascript:x" }).success).toBe(
      false,
    );
  });
});

describe("tagSchema", () => {
  it("trims, collapses spaces and defaults the color", () => {
    expect(tagSchema.parse({ name: "  Machine   Learning " })).toEqual({
      name: "Machine Learning",
      color: "slate",
    });
  });

  it("enforces 1 to 30 characters", () => {
    expect(tagSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(tagSchema.safeParse({ name: "x".repeat(31) }).success).toBe(false);
    expect(tagSchema.safeParse({ name: "x".repeat(30) }).success).toBe(true);
  });

  it("only allows palette colors", () => {
    expect(tagSchema.safeParse({ name: "A", color: "red" }).success).toBe(false);
    expect(tagSchema.parse({ name: "A", color: "plum" }).color).toBe("plum");
  });

  it("update requires at least one field", () => {
    expect(tagUpdateSchema.safeParse({}).success).toBe(false);
    expect(tagUpdateSchema.parse({ color: "teal" })).toEqual({ color: "teal" });
  });
});

describe("formToObject", () => {
  it("keeps string fields and drops Next.js action fields", () => {
    const fd = new FormData();
    fd.set("company", "Acme");
    fd.set("$ACTION_ID_abc", "");
    expect(formToObject(fd)).toEqual({ company: "Acme" });
  });
});
