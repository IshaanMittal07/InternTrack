import { describe, expect, it } from "vitest";

import { parsePostingHtml } from "@/lib/domain/posting";
import { fetchPostingHtml } from "@/server/services/posting-import";

describe("parsePostingHtml", () => {
  it("extracts JobPosting data from JSON-LD", () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Engineering Intern",
      "hiringOrganization":{"@type":"Organization","name":"Acme"},
      "jobLocation":{"address":{"addressLocality":"Seattle","addressRegion":"WA"}},
      "validThrough":"2027-02-01T23:59:00-08:00","description":"<p>Build useful things.</p>"}
    </script>`;

    expect(parsePostingHtml(html)).toEqual({
      company: "Acme",
      role_title: "Engineering Intern",
      location: "Seattle, WA",
      deadline: "2027-02-01",
      posting_notes: "Build useful things.",
    });
  });

  it("reads Open Graph and title metadata when structured data is absent", () => {
    expect(
      parsePostingHtml(`<title>Designer at Acme</title>
        <meta property="og:site_name" content="Acme Careers">
        <meta property="og:description" content="Join our team &amp; grow.">`),
    ).toEqual({
      company: "Acme Careers",
      role_title: "Designer at Acme",
      posting_notes: "Join our team & grow.",
    });
  });

  it("returns no fields for pages without job metadata", () => {
    expect(parsePostingHtml("<html><title>Welcome</title></html>")).toEqual({
      role_title: "Welcome",
    });
  });

  it.each([
    "http://example.com/job",
    "https://127.0.0.1",
    "https://localhost/job",
    "https://example.com:8443/job",
  ])(
    "refuses unsafe URL %s without fetching it",
    async (url) => {
      await expect(fetchPostingHtml(url)).rejects.toThrow();
    },
  );
});