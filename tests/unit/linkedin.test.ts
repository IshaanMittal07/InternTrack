import { describe, expect, it } from "vitest";

import { contactBookmarkletHref } from "@/lib/domain/bookmarklet";
import {
  canonicalLinkedInProfileUrl,
  parseLinkedInProfile,
  sameCompany,
} from "@/lib/domain/linkedin";

/** Runs the contact bookmark against a fake LinkedIn page and returns the URL it opens. */
function runContactBookmarklet({
  href,
  title,
  elements = {},
  companyLabel,
}: {
  href: string;
  title: string;
  elements?: Record<string, string>;
  companyLabel?: string;
}): URL {
  const code = decodeURIComponent(contactBookmarkletHref("https://tracker.example").slice(11));
  const location = { href };
  const document = {
    title,
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
    });
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
