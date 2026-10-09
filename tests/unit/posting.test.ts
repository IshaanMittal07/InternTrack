import { describe, expect, it } from "vitest";

import { greenhouseApiUrl, parseGreenhouseJob, parsePostingHtml } from "@/lib/domain/posting";
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

  it("strips description HTML that was escaped twice", () => {
    const html = `<script type="application/ld+json">
      {"@type":"JobPosting","title":"Intern",
      "description":"&lt;p&gt;Join us.&lt;br&gt;&lt;br&gt;Build things.&lt;/p&gt;"}
    </script>`;
    expect(parsePostingHtml(html).posting_notes).toBe("Join us. Build things.");
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
  ])("refuses unsafe URL %s without fetching it", async (url) => {
    await expect(fetchPostingHtml(url)).rejects.toThrow();
  });
});
describe("greenhouseApiUrl", () => {
  it.each([
    ["https://job-boards.greenhouse.io/anthropic/jobs/4461450008", "anthropic", "4461450008"],
    ["https://boards.greenhouse.io/anthropic/jobs/4461450008?gh_src=x", "anthropic", "4461450008"],
    ["https://boards.greenhouse.io/embed/job_app?for=acme&token=123", "acme", "123"],
  ])("maps %s to the job API", (url, board, id) => {
    expect(greenhouseApiUrl(url)).toBe(
      `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`,
    );
  });

  it.each(["https://example.com/acme/jobs/1", "https://boards.greenhouse.io/acme", "not a url"])(
    "ignores %s",
    (url) => {
      expect(greenhouseApiUrl(url)).toBeNull();
    },
  );
});

describe("parseGreenhouseJob", () => {
  it("reads company, role, location and the escaped description", () => {
    expect(
      parseGreenhouseJob({
        company_name: "Anthropic",
        title: "Engineering Intern",
        location: { name: "San Francisco, CA" },
        content: "&lt;p&gt;About &amp;amp; more&lt;/p&gt;",
      }),
    ).toEqual({
      company: "Anthropic",
      role_title: "Engineering Intern",
      location: "San Francisco, CA",
      posting_notes: "About & more",
    });
  });

  it("returns nothing for unexpected data", () => {
    expect(parseGreenhouseJob(null)).toEqual({});
    expect(parseGreenhouseJob([1, 2])).toEqual({});
  });
});
