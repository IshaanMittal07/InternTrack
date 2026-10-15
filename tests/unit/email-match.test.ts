import { describe, expect, it } from "vitest";

import { matchRejection, nameWords, parseFrom, type AppliedPosting } from "@/lib/email/match";

let n = 0;
function posting(fields: Partial<AppliedPosting> & { company: string }): AppliedPosting {
  n += 1;
  return {
    id: `id-${n}`,
    role_title: null,
    date_applied: "2026-09-01",
    application_stage: "submitted",
    ...fields,
  };
}

const base = {
  from: "Recruiting <no-reply@greenhouse.io>",
  subject: "",
  body: "",
  receivedOn: "2026-10-10",
};

describe("nameWords", () => {
  it("drops legal suffixes and punctuation", () => {
    expect(nameWords("Jane Street Capital, LLC")).toEqual(["jane", "street", "capital"]);
    expect(nameWords("Palantir Technologies Inc.")).toEqual(["palantir"]);
    expect(nameWords("AT&T")).toEqual(["at", "and", "t"]);
    expect(nameWords("Labs")).toEqual(["labs"]);
  });
});

describe("parseFrom", () => {
  it("splits name and address", () => {
    expect(parseFrom('"Stripe Recruiting" <No-Reply@Stripe.com>')).toEqual({
      name: "Stripe Recruiting",
      address: "no-reply@stripe.com",
    });
    expect(parseFrom("jobs@ramp.com")).toEqual({ name: "", address: "jobs@ramp.com" });
  });
});

describe("matchRejection", () => {
  it("matches the company in the sender name", () => {
    const stripe = posting({ company: "Stripe" });
    const other = posting({ company: "Shopify" });
    expect(
      matchRejection({ ...base, from: "Stripe Recruiting <no-reply@greenhouse.io>" }, [
        stripe,
        other,
      ]),
    ).toEqual({ outcome: "rejected", opportunityId: stripe.id });
  });

  it("matches the company in the sender's domain or mailbox", () => {
    const js = posting({ company: "Jane Street" });
    expect(matchRejection({ ...base, from: "Recruiting <campus@janestreet.com>" }, [js])).toEqual({
      outcome: "rejected",
      opportunityId: js.id,
    });
    const ramp = posting({ company: "Ramp" });
    expect(matchRejection({ ...base, from: "ramp@myworkday.com" }, [ramp])).toEqual({
      outcome: "rejected",
      opportunityId: ramp.id,
    });
  });

  it("matches the company in the subject", () => {
    const p = posting({ company: "Palantir Technologies" });
    expect(matchRejection({ ...base, subject: "Your application to Palantir" }, [p])).toEqual({
      outcome: "rejected",
      opportunityId: p.id,
    });
  });

  it("uses the body only when the sender and subject name no company", () => {
    const notion = posting({ company: "Notion" });
    expect(
      matchRejection({ ...base, body: "Thank you for your interest in Notion." }, [notion]),
    ).toEqual({ outcome: "rejected", opportunityId: notion.id });
  });

  it("needs a capitalized company name in the body", () => {
    const ramp = posting({ company: "Ramp" });
    expect(
      matchRejection({ ...base, body: "We need people who can ramp up fast." }, [ramp]),
    ).toEqual({
      outcome: "unmatched",
    });
  });

  it("does not match part of a word", () => {
    const meta = posting({ company: "Meta" });
    expect(matchRejection({ ...base, subject: "Metadata team update" }, [meta])).toEqual({
      outcome: "unmatched",
    });
  });

  it("prefers the sender/subject company over others named in the body", () => {
    const stripe = posting({ company: "Stripe" });
    const shopify = posting({ company: "Shopify" });
    expect(
      matchRejection(
        { ...base, subject: "Stripe application", body: "Our partners like Shopify..." },
        [stripe, shopify],
      ),
    ).toEqual({ outcome: "rejected", opportunityId: stripe.id });
  });

  it("is ambiguous when two different companies are named", () => {
    const a = posting({ company: "Stripe" });
    const b = posting({ company: "Shopify" });
    expect(matchRejection({ ...base, subject: "Stripe and Shopify" }, [a, b])).toEqual({
      outcome: "ambiguous",
    });
  });

  it("prefers the longer company name when one contains the other", () => {
    const google = posting({ company: "Google" });
    const deepmind = posting({ company: "Google DeepMind" });
    expect(
      matchRejection({ ...base, subject: "Your Google DeepMind application" }, [google, deepmind]),
    ).toEqual({ outcome: "rejected", opportunityId: deepmind.id });
  });

  it("skips postings that are already closed", () => {
    const p = posting({ company: "Stripe", application_stage: "offer" });
    expect(matchRejection({ ...base, subject: "Stripe" }, [p])).toEqual({
      outcome: "skipped",
      opportunityId: p.id,
      reason: "closed",
    });
  });

  it("skips an email that arrived before the application", () => {
    const p = posting({ company: "Stripe", date_applied: "2026-10-11" });
    expect(matchRejection({ ...base, subject: "Stripe" }, [p])).toEqual({
      outcome: "skipped",
      opportunityId: p.id,
      reason: "before_applied",
    });
  });

  it("chooses the in-progress posting when the other one is closed", () => {
    const old = posting({ company: "Stripe", application_stage: "rejected" });
    const current = posting({ company: "Stripe", application_stage: "interviewing" });
    expect(matchRejection({ ...base, subject: "Stripe" }, [old, current])).toEqual({
      outcome: "rejected",
      opportunityId: current.id,
    });
  });

  it("uses the role title to pick between several open postings", () => {
    const swe = posting({ company: "Google", role_title: "Software Engineering Intern" });
    const pm = posting({ company: "Google", role_title: "Product Manager Intern" });
    expect(
      matchRejection(
        { ...base, subject: "Google", body: "Regarding the Product Manager Intern role..." },
        [swe, pm],
      ),
    ).toEqual({ outcome: "rejected", opportunityId: pm.id });
  });

  it("prefers the longer role title when one contains the other", () => {
    const a = posting({ company: "Google", role_title: "Software Engineer Intern" });
    const b = posting({
      company: "Google",
      role_title: "Software Engineer Intern, Infrastructure",
    });
    expect(
      matchRejection({ ...base, subject: "Google: Software Engineer Intern, Infrastructure" }, [
        a,
        b,
      ]),
    ).toEqual({ outcome: "rejected", opportunityId: b.id });
  });

  it("is ambiguous when several open postings can't be told apart", () => {
    const a = posting({ company: "Google", role_title: "SWE Intern" });
    const b = posting({ company: "Google", role_title: "PM Intern" });
    expect(matchRejection({ ...base, subject: "Your Google application" }, [a, b])).toEqual({
      outcome: "ambiguous",
    });
  });

  it("ignores company names that appear only in quoted text", () => {
    const p = posting({ company: "Stripe" });
    expect(matchRejection({ ...base, body: "Hi\n> Thanks for applying to Stripe" }, [p])).toEqual({
      outcome: "unmatched",
    });
  });

  it("reports unmatched when no posting fits", () => {
    expect(matchRejection({ ...base, subject: "Acme" }, [posting({ company: "Stripe" })])).toEqual({
      outcome: "unmatched",
    });
  });
});
