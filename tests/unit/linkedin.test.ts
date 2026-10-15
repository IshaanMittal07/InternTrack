import { describe, expect, it } from "vitest";

import { contactBookmarkletHref } from "@/lib/domain/bookmarklet";
import {
  canonicalLinkedInProfileUrl,
  parseExperience,
  parseLinkedInProfile,
  roleAt,
  sameCompany,
} from "@/lib/domain/linkedin";

/** Runs the contact bookmark against a fake LinkedIn page and returns the URL it opens. */
function runContactBookmarklet({
  href,
  title,
  elements = {},
  companyLabel,
  experience,
}: {
  href: string;
  title: string;
  elements?: Record<string, string>;
  companyLabel?: string;
  /** Each top-level Experience entry's span texts. */
  experience?: string[][];
}): URL {
  const code = decodeURIComponent(contactBookmarkletHref("https://tracker.example").slice(11));
  const location = { href };
  const spans = (lines: string[]) => lines.map((textContent) => ({ textContent }));
  // Every entry also holds a nested <li> (as grouped roles do), which must be skipped.
  const lis = (experience ?? []).flatMap((lines) => {
    const top = { parentElement: { closest: () => null }, querySelectorAll: () => spans(lines) };
    const nested = {
      parentElement: { closest: () => top },
      querySelectorAll: () => spans(["Nested", "Jan 2020 - Present"]),
    };
    return [top, nested];
  });
  const section = { querySelectorAll: () => lis, contains: () => true };
  const document = {
    title,
    getElementById: (id: string) =>
      id === "experience" && experience ? { closest: () => section } : null,
    querySelectorAll: () => [],
    querySelector: (selector: string) => {
      if (selector === '[aria-label^="Current company"]') {
        return companyLabel ? { getAttribute: () => companyLabel } : null;
      }
      const textContent = elements[selector];
      return textContent === undefined ? null : { textContent };
    },
  };
  let opened = "";
  const window = {
    open: (url: string) => {
      opened = url;
      return {};
    },
  };
  new Function("document", "location", "window", code)(document, location, window);
  return new URL(opened);
}

describe("contact bookmarklet", () => {
  it("is a javascript: link", () => {
    expect(contactBookmarkletHref("https://tracker.example")).toMatch(/^javascript:/);
  });

  it("opens /save/contact with the name, headline and current company", () => {
    const opened = runContactBookmarklet({
      href: "https://www.linkedin.com/in/jane-doe-1a2b/?miniProfileUrn=x",
      title: "(3) Jane Doe | LinkedIn",
      elements: {
        "main h1": "\n   Jane   Doe \n",
        "main .text-body-medium": " Technical Recruiter at Shopify ",
      },
      companyLabel: "Current company: Shopify. Click to skip to experience card",
    });
    expect(opened.origin).toBe("https://tracker.example");
    expect(opened.pathname).toBe("/save/contact");
    expect(opened.searchParams.get("url")).toBe(
      "https://www.linkedin.com/in/jane-doe-1a2b/?miniProfileUrn=x",
    );
    expect(opened.searchParams.get("name")).toBe("Jane Doe");
    expect(opened.searchParams.get("headline")).toBe("Technical Recruiter at Shopify");
    expect(opened.searchParams.get("company")).toBe(
      "Current company: Shopify. Click to skip to experience card",
    );
    expect(opened.searchParams.get("title")).toBe("(3) Jane Doe | LinkedIn");
  });

  it("sends the text of each top-level Experience entry", () => {
    const opened = runContactBookmarklet({
      href: "https://www.linkedin.com/in/jane-doe/",
      title: "Jane Doe | LinkedIn",
      experience: [
        [
          "Technical  Recruiter",
          "Shopify · Full-time",
          "Shopify · Full-time",
          "Jan 2024 - Present",
        ],
        ["Intern", "Stripe · Internship", "May 2023 - Aug 2023"],
      ],
    });
    expect(JSON.parse(opened.searchParams.get("experience")!)).toEqual([
      ["Technical Recruiter", "Shopify · Full-time", "Jan 2024 - Present"],
      ["Intern", "Stripe · Internship", "May 2023 - Aug 2023"],
    ]);
  });

  it("sends only the link and title when the page has none of those parts", () => {
    const opened = runContactBookmarklet({ href: "https://www.linkedin.com/feed/", title: "Feed" });
    expect([...opened.searchParams.keys()]).toEqual(["url", "title"]);
  });
});

describe("canonicalLinkedInProfileUrl", () => {
  it("keeps only the profile path", () => {
    expect(
      canonicalLinkedInProfileUrl("https://ca.linkedin.com/in/jane-doe/overlay/contact-info/?x=1"),
    ).toBe("https://www.linkedin.com/in/jane-doe/");
    expect(canonicalLinkedInProfileUrl("http://linkedin.com/in/jane-doe")).toBe(
      "https://www.linkedin.com/in/jane-doe/",
    );
  });

  it("rejects anything that is not a LinkedIn profile", () => {
    expect(canonicalLinkedInProfileUrl("https://www.linkedin.com/feed/")).toBe("");
    expect(canonicalLinkedInProfileUrl("https://www.linkedin.com/company/shopify/")).toBe("");
    expect(canonicalLinkedInProfileUrl("https://evil-linkedin.com/in/jane")).toBe("");
    expect(canonicalLinkedInProfileUrl("javascript:alert(1)")).toBe("");
    expect(canonicalLinkedInProfileUrl("not a url")).toBe("");
    expect(canonicalLinkedInProfileUrl(undefined)).toBe("");
  });
});

describe("parseLinkedInProfile", () => {
  it("uses the top card's current company and the headline's role", () => {
    expect(
      parseLinkedInProfile({
        url: "https://www.linkedin.com/in/jane-doe/",
        name: "Jane Doe",
        headline: "Technical Recruiter at Shopify | Hiring 2027 interns",
        company: "Current company: Shopify Inc.. Click to skip to experience card",
      }),
    ).toEqual({
      name: "Jane Doe",
      title: "Technical Recruiter",
      company: "Shopify Inc.",
      linkedin_url: "https://www.linkedin.com/in/jane-doe/",
      experience: [],
    });
  });

  it("falls back to the company named in the headline", () => {
    expect(parseLinkedInProfile({ headline: "SWE @ Stripe" })).toMatchObject({
      title: "SWE",
      company: "Stripe",
    });
    expect(parseLinkedInProfile({ headline: "Engineering Manager at Jane Street" })).toMatchObject({
      title: "Engineering Manager",
      company: "Jane Street",
    });
  });

  it("keeps a headline without a company as the title", () => {
    expect(parseLinkedInProfile({ headline: "Software Engineer" })).toMatchObject({
      title: "Software Engineer",
      company: "",
    });
  });

  it("takes the name from the page title when the heading is missing", () => {
    expect(parseLinkedInProfile({ title: "(12) Jane Doe | LinkedIn" }).name).toBe("Jane Doe");
    expect(parseLinkedInProfile({ title: "Jane Doe - Shopify | LinkedIn" }).name).toBe("Jane Doe");
  });

  it("shortens long values to the contact form's limits", () => {
    const parsed = parseLinkedInProfile({ name: "N".repeat(300), headline: "T".repeat(300) });
    expect(parsed.name).toHaveLength(120);
    expect(parsed.title).toHaveLength(120);
  });

  it("returns empty fields for nothing", () => {
    expect(parseLinkedInProfile({})).toEqual({
      name: "",
      title: "",
      company: "",
      linkedin_url: "",
      experience: [],
    });
  });
});

describe("parseExperience", () => {
  const single = [
    "Software Engineer Intern",
    "Shopify · Internship",
    "May 2025 - Aug 2025 · 4 mos",
  ];
  const grouped = [
    "Google",
    "Full-time · 3 yrs 2 mos",
    "Toronto, Ontario, Canada",
    "Senior Recruiter",
    "Jan 2024 - Present · 1 yr 10 mos",
    "University Recruiter",
    "Sep 2022 - Dec 2023 · 1 yr 4 mos",
  ];

  it("reads a single role and its company", () => {
    expect(parseExperience(JSON.stringify([single]))).toEqual([
      { role: "Software Engineer Intern", company: "Shopify" },
    ]);
  });

  it("takes the newest role from a company with several roles", () => {
    expect(parseExperience(JSON.stringify([grouped]))).toEqual([
      { role: "Senior Recruiter", company: "Google" },
    ]);
  });

  it("ignores entries without dates and malformed input", () => {
    expect(
      parseExperience(JSON.stringify([["Show all 9 experiences"], "x", [1, 2], single])),
    ).toEqual([{ role: "Software Engineer Intern", company: "Shopify" }]);
    expect(parseExperience("not json")).toEqual([]);
    expect(parseExperience('{"a":1}')).toEqual([]);
    expect(parseExperience(undefined)).toEqual([]);
  });

  it("finds their role at a given company", () => {
    const experience = parseExperience(JSON.stringify([grouped, single]));
    expect(roleAt(experience, "Shopify Inc.")).toBe("Software Engineer Intern");
    expect(roleAt(experience, "Google LLC")).toBe("Senior Recruiter");
    expect(roleAt(experience, "Stripe")).toBeUndefined();
  });

  it("uses the role at their current company over the headline", () => {
    const parsed = parseLinkedInProfile({
      headline: "CS @ Waterloo | ex-Shopify",
      company: "Current company: Google. Click to skip to experience card",
      experience: JSON.stringify([single, grouped]),
    });
    expect(parsed.title).toBe("Senior Recruiter");
    expect(parsed.company).toBe("Google");
  });

  it("falls back to their newest role, then the headline", () => {
    expect(parseLinkedInProfile({ experience: JSON.stringify([single]) })).toMatchObject({
      title: "Software Engineer Intern",
      company: "Shopify",
    });
    expect(parseLinkedInProfile({ headline: "Recruiter at Stripe" }).title).toBe("Recruiter");
  });
});

describe("sameCompany", () => {
  it("ignores suffixes, case and punctuation", () => {
    expect(sameCompany("Shopify Inc.", "shopify")).toBe(true);
    expect(sameCompany("Jane Street Capital, LLC", "Jane Street Capital")).toBe(true);
  });

  it("matches a longer name that contains the other as whole words", () => {
    expect(sameCompany("Google", "Google DeepMind")).toBe(true);
    expect(sameCompany("Meta", "Metaview")).toBe(false);
  });

  it("never matches an empty name", () => {
    expect(sameCompany("", "")).toBe(false);
    expect(sameCompany("Shopify", "")).toBe(false);
  });
});
