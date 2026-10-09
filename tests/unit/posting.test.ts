import { describe, expect, it } from "vitest";

import {
  cleanCompanyName,
  cleanRoleTitle,
  companyFromUrl,
  greenhouseApiUrl,
  leverPostingUrl,
  parseGreenhouseJob,
  parsePostingHtml,
  parseWorkableAccount,
  parseWorkdaySidebar,
  workableAccountApiUrl,
  workdaySidebarUrl,
} from "@/lib/domain/posting";
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

describe("company detection", () => {
  it("cleans job-site and legal suffixes from company names", () => {
    expect(cleanCompanyName("Amazon.jobs")).toBe("Amazon");
    expect(cleanCompanyName("WTW External Careers Site")).toBe("WTW");
    expect(cleanCompanyName("General Motors LLC")).toBe("General Motors");
    expect(cleanCompanyName("Papa John's USA, Inc.")).toBe("Papa John's USA");
    expect(cleanCompanyName("Bosch Group")).toBe("Bosch Group");
    expect(cleanCompanyName("Careers")).toBe("Careers");
  });

  it("drops the company from role titles", () => {
    expect(cleanRoleTitle("Engineer, ML Tools - EMEA Remote - Hugging Face", "Hugging Face")).toBe(
      "Engineer, ML Tools - EMEA Remote",
    );
    expect(cleanRoleTitle("Viget - Software Developer Intern", "Viget")).toBe(
      "Software Developer Intern",
    );
    expect(cleanRoleTitle("Intern at Acme", "Acme")).toBe("Intern");
    expect(cleanRoleTitle("Acme", "Acme")).toBe("Acme");
    expect(cleanRoleTitle("Intern", undefined)).toBe("Intern");
  });

  it.each([
    ["https://jobs.lever.co/viget/abc/apply", "Viget"],
    ["https://job-boards.greenhouse.io/sigma-computing/jobs/1", "Sigma Computing"],
    ["https://boards.greenhouse.io/embed/job_app?for=acme&token=1", "Acme"],
    ["https://modmed.wd501.myworkdayjobs.com/ModMed12/job/x", "Modmed"],
    ["https://careers-peraton.icims.com/jobs/1/job", "Peraton"],
    ["https://careers.itw.com/global/en/job/1", "Itw"],
    ["https://jobs.acme.co.uk/role/1", "Acme"],
  ])("guesses the company from %s", (url, company) => {
    expect(companyFromUrl(url)).toBe(company);
  });

  it.each([
    "https://eedu.fa.em3.oraclecloud.com/job/1",
    "https://www.linkedin.com/jobs/view/1",
    "not a url",
  ])("makes no guess for shared job platforms like %s", (url) => {
    expect(companyFromUrl(url)).toBeUndefined();
  });

  it("builds site API URLs", () => {
    expect(leverPostingUrl("https://jobs.lever.co/viget/abc/apply")).toBe(
      "https://jobs.lever.co/viget/abc",
    );
    expect(leverPostingUrl("https://example.com/apply")).toBe("https://example.com/apply");
    expect(workableAccountApiUrl("https://apply.workable.com/huggingface/j/X1")).toBe(
      "https://apply.workable.com/api/v1/accounts/huggingface",
    );
    expect(
      workdaySidebarUrl("https://globalhr.wd5.myworkdayjobs.com/en-US/rec_rtx/job/US/Intern_1"),
    ).toBe("https://globalhr.wd5.myworkdayjobs.com/wday/cxs/globalhr/rec_rtx/sidebar");
    expect(workdaySidebarUrl("https://example.com/job/1")).toBeNull();
  });

  it("reads the company from Workable and Workday API responses", () => {
    expect(parseWorkableAccount({ name: "Hugging Face" })).toBe("Hugging Face");
    expect(parseWorkdaySidebar([{ type: "TEXT" }, { type: "IMAGE", altText: "RTX" }])).toBe("RTX");
    expect(parseWorkdaySidebar([{ altText: "Acme logo" }])).toBe("Acme");
    expect(parseWorkdaySidebar([{ altText: "Logo" }])).toBeUndefined();
    expect(parseWorkdaySidebar({})).toBeUndefined();
  });

  it("accepts a plain-text hiringOrganization in JSON-LD", () => {
    const html = `<script type="application/ld+json">{"@type":"JobPosting","title":"Intern","hiringOrganization":"Acme"}</script>`;
    expect(parsePostingHtml(html).company).toBe("Acme");
  });
});
