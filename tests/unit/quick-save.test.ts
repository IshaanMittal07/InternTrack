import { describe, expect, it, vi } from "vitest";

import { bookmarkletHref } from "@/lib/domain/bookmarklet";
import {
  canonicalPostingUrl,
  detailsFromPageTitle,
  mergePostingDetails,
  truncatePostingDetails,
} from "@/lib/domain/posting";
import type { Db } from "@/lib/domain/types";
import { NEEDS_COMPANY, quickSavePosting } from "@/server/services/quick-save";

/** Runs the bookmark's code against a fake page and returns the URL it opens. */
function runBookmarklet({
  href,
  title,
  jsonLd = [],
  popupBlocked = false,
}: {
  href: string;
  title: string;
  jsonLd?: string[];
  popupBlocked?: boolean;
}): string {
  const code = decodeURIComponent(bookmarkletHref("https://tracker.example").slice(11));
  const location = { href };
  const document = {
    title,
    querySelectorAll: (selector: string) => {
      expect(selector).toBe('script[type="application/ld+json"]');
      return jsonLd.map((textContent) => ({ textContent }));
    },
  };
  let opened = "";
  const window = {
    open: (url: string, target: string) => {
      expect(target).toBe("_blank");
      opened = url;
      return popupBlocked ? null : {};
    },
  };
  new Function("document", "location", "window", code)(document, location, window);
  return popupBlocked ? location.href : opened;
}

describe("bookmarklet", () => {
  it("is a javascript: link", () => {
    expect(bookmarkletHref("https://tracker.example")).toMatch(/^javascript:/);
  });

  it("opens /save with the page link, title and JobPosting details", () => {
    const opened = new URL(
      runBookmarklet({
        href: "https://jobs.example.com/123?x=1",
        title: "Intern - Acme",
        jsonLd: [
          "not json",
          JSON.stringify({ "@type": "Organization", name: "Ignored" }),
          JSON.stringify({
            "@graph": [
              {
                "@type": ["JobPosting"],
                title: "SWE Intern",
                hiringOrganization: { name: "Acme" },
              },
            ],
          }),
        ],
      }),
    );
    expect(opened.origin).toBe("https://tracker.example");
    expect(opened.pathname).toBe("/save");
    expect(opened.searchParams.get("url")).toBe("https://jobs.example.com/123?x=1");
    expect(opened.searchParams.get("company")).toBe("Acme");
    expect(opened.searchParams.get("role")).toBe("SWE Intern");
    expect(opened.searchParams.get("title")).toBe("Intern - Acme");
  });

  it("sends only the link and title when the page has no job data", () => {
    const opened = new URL(runBookmarklet({ href: "https://a.example/job", title: "Job" }));
    expect(opened.searchParams.has("company")).toBe(false);
    expect(opened.searchParams.has("role")).toBe(false);
    expect(opened.searchParams.get("title")).toBe("Job");
  });

  it("accepts a plain-text hiring organization", () => {
    const opened = new URL(
      runBookmarklet({
        href: "https://a.example/job",
        title: "Job",
        jsonLd: [
          JSON.stringify({ "@type": "JobPosting", title: "Intern", hiringOrganization: "Acme" }),
        ],
      }),
    );
    expect(opened.searchParams.get("company")).toBe("Acme");
  });

  it("goes to the page in the same tab when pop-ups are blocked", () => {
    const href = runBookmarklet({
      href: "https://a.example/job",
      title: "Job",
      popupBlocked: true,
    });
    expect(new URL(href).pathname).toBe("/save");
  });
});

describe("canonicalPostingUrl", () => {
  it("drops fragments and tracking parameters, keeping the rest", () => {
    expect(
      canonicalPostingUrl("https://jobs.lever.co/acme/1?utm_source=x&lever-source=y&gclid=z#apply"),
    ).toBe("https://jobs.lever.co/acme/1?lever-source=y");
  });

  it("turns a LinkedIn search page into the open job's page", () => {
    expect(
      canonicalPostingUrl(
        "https://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=intern",
      ),
    ).toBe("https://www.linkedin.com/jobs/view/4012345678/");
    expect(canonicalPostingUrl("https://www.linkedin.com/jobs/view/4012345678/?trk=abc")).toBe(
      "https://www.linkedin.com/jobs/view/4012345678/",
    );
  });

  it("leaves other sites' currentJobId alone and returns bad links unchanged", () => {
    expect(canonicalPostingUrl("https://example.com/?currentJobId=1")).toBe(
      "https://example.com/?currentJobId=1",
    );
    expect(canonicalPostingUrl("not a url")).toBe("not a url");
  });
});

describe("detailsFromPageTitle", () => {
  it("reads role and company from LinkedIn titles", () => {
    expect(
      detailsFromPageTitle(
        "(3) Software Engineer Intern | Acme | LinkedIn",
        "https://www.linkedin.com/jobs/view/1/",
      ),
    ).toEqual({ role_title: "Software Engineer Intern", company: "Acme" });
  });

  it("only takes the role elsewhere", () => {
    expect(detailsFromPageTitle("Data Intern | Careers", "https://acme.com/jobs/1")).toEqual({
      role_title: "Data Intern",
    });
    expect(detailsFromPageTitle("", "https://acme.com/jobs/1")).toEqual({});
  });
});

describe("mergePostingDetails", () => {
  const source = "https://jobs.example.org/42";

  it("trusts the page over the server, and the server over the title", () => {
    expect(
      mergePostingDetails({
        page: { company: "Acme Inc.", role_title: "SWE Intern" },
        fetched: { company: "Other", role_title: "Other role", location: "Toronto" },
        title: "Title role",
        source,
      }),
    ).toEqual({ company: "Acme", role_title: "SWE Intern", location: "Toronto" });

    expect(
      mergePostingDetails({
        page: {},
        fetched: { company: "Beta" },
        title: "Intern - Beta",
        source,
      }),
    ).toEqual({ company: "Beta", role_title: "Intern" });
  });

  it("falls back to the company in the link", () => {
    expect(
      mergePostingDetails({ page: {}, fetched: {}, source: "https://jobs.lever.co/viget/1" }),
    ).toEqual({ company: "Viget" });
  });

  it("leaves the company out when nothing names it", () => {
    expect(
      mergePostingDetails({
        page: { company: "  " },
        fetched: {},
        title: "Intern",
        source: "https://www.linkedin.com/jobs/view/1/",
      }),
    ).toEqual({ role_title: "Intern" });
  });

  it("shortens long values to what the form accepts", () => {
    const merged = mergePostingDetails({ page: { company: "A".repeat(500) }, fetched: {}, source });
    expect(merged.company).toHaveLength(120);
    expect(truncatePostingDetails({ role_title: "x".repeat(10) })).toEqual({
      role_title: "x".repeat(10),
    });
  });
});

type Row = {
  id: string;
  category: "applied" | "planning" | "interested";
  company: string;
  role_title: string | null;
  posting_url: string | null;
};

/** Just enough of the Supabase client for quickSavePosting. */
function fakeDb(rows: Row[]) {
  const inserts: Record<string, unknown>[] = [];
  const updates: { patch: Record<string, unknown>; id: unknown }[] = [];
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          not: async () => ({ data: rows.filter((r) => r.posting_url !== null), error: null }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: (_column: string, id: unknown) => ({
          eq: async () => {
            updates.push({ patch, id });
            return { error: null };
          },
        }),
      }),
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            inserts.push(row);
            return { data: { id: "new-id" }, error: null };
          },
        }),
      }),
    }),
  };
  return { db: db as unknown as Db, inserts, updates };
}

const today = "2026-10-13";

describe("quickSavePosting", () => {
  it("creates an applied posting dated today from the page and the link", async () => {
    const { db, inserts } = fakeDb([]);
    const readPosting = vi.fn(async () => ({
      company: "Server Co",
      role_title: "Server role",
      location: "Remote",
      posting_notes: "About the job",
    }));
    const result = await quickSavePosting(
      db,
      "user-1",
      { url: "https://jobs.example.com/1#top", company: "Acme", role: "SWE Intern" },
      today,
      readPosting,
    );

    expect(readPosting).toHaveBeenCalledWith("https://jobs.example.com/1");
    expect(result).toEqual({
      ok: true,
      data: {
        id: "new-id",
        company: "Acme",
        role_title: "SWE Intern",
        category: "applied",
        outcome: "created",
      },
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      user_id: "user-1",
      category: "applied",
      company: "Acme",
      role_title: "SWE Intern",
      posting_url: "https://jobs.example.com/1",
      location: "Remote",
      posting_notes: "About the job",
      date_applied: today,
      application_stage: "submitted",
      priority: "medium",
    });
  });

  it("still saves when the server can't read the link", async () => {
    const { db, inserts } = fakeDb([]);
    const result = await quickSavePosting(
      db,
      "user-1",
      {
        url: "https://www.linkedin.com/jobs/search/?currentJobId=99",
        title: "Data Intern | Beta | LinkedIn",
      },
      today,
      async () => {
        throw new Error("blocked");
      },
    );
    expect(result.ok).toBe(true);
    expect(inserts[0]).toMatchObject({
      company: "Beta",
      role_title: "Data Intern",
      posting_url: "https://www.linkedin.com/jobs/view/99/",
    });
  });

  it("asks for the company when nothing names it", async () => {
    const { db, inserts } = fakeDb([]);
    const result = await quickSavePosting(
      db,
      "user-1",
      { url: "https://www.linkedin.com/jobs/view/1/", title: "Intern" },
      today,
      async () => ({}),
    );
    expect(result).toEqual({
      ok: false,
      error: NEEDS_COMPANY,
      fieldErrors: { company: "Enter the company name" },
    });
    expect(inserts).toHaveLength(0);
  });

  it("moves a saved posting with the same link to Applied instead of duplicating it", async () => {
    const { db, inserts, updates } = fakeDb([
      {
        id: "p1",
        category: "planning",
        company: "Acme",
        role_title: "Intern",
        posting_url: "https://jobs.example.com/1?utm_source=newsletter",
      },
    ]);
    const readPosting = vi.fn(async () => ({}));
    const result = await quickSavePosting(
      db,
      "user-1",
      { url: "https://jobs.example.com/1" },
      today,
      readPosting,
    );
    expect(result).toEqual({
      ok: true,
      data: {
        id: "p1",
        company: "Acme",
        role_title: "Intern",
        category: "applied",
        outcome: "moved",
      },
    });
    expect(updates).toEqual([
      {
        id: "p1",
        patch: { category: "applied", date_applied: today, application_stage: "submitted" },
      },
    ]);
    expect(inserts).toHaveLength(0);
    expect(readPosting).not.toHaveBeenCalled();
  });

  it("changes nothing when the posting is already applied", async () => {
    const { db, inserts, updates } = fakeDb([
      {
        id: "p2",
        category: "applied",
        company: "Acme",
        role_title: null,
        posting_url: "https://jobs.example.com/2",
      },
    ]);
    const result = await quickSavePosting(
      db,
      "user-1",
      { url: "https://jobs.example.com/2#apply" },
      today,
      async () => ({}),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        id: "p2",
        company: "Acme",
        role_title: null,
        category: "applied",
        outcome: "already",
      },
    });
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("saves under the chosen category, without a date applied", async () => {
    const { db, inserts } = fakeDb([]);
    const result = await quickSavePosting(
      db,
      "user-1",
      { url: "https://jobs.example.com/3", company: "Acme", category: "planning" },
      today,
      async () => ({}),
    );
    expect(result).toMatchObject({ ok: true, data: { category: "planning", outcome: "created" } });
    expect(inserts[0]).toMatchObject({
      category: "planning",
      date_applied: null,
      application_stage: null,
    });
  });

  it("moves a saved posting between Planning and Interested", async () => {
    const { db, updates } = fakeDb([
      {
        id: "p4",
        category: "planning",
        company: "Acme",
        role_title: null,
        posting_url: "https://jobs.example.com/4",
      },
    ]);
    const result = await quickSavePosting(
      db,
      "user-1",
      { url: "https://jobs.example.com/4", category: "interested" },
      today,
      async () => ({}),
    );
    expect(result).toMatchObject({ ok: true, data: { category: "interested", outcome: "moved" } });
    expect(updates).toEqual([{ id: "p4", patch: { category: "interested" } }]);
  });

  it("never moves a posting out of Applied", async () => {
    const { db, updates } = fakeDb([
      {
        id: "p5",
        category: "applied",
        company: "Acme",
        role_title: null,
        posting_url: "https://jobs.example.com/5",
      },
    ]);
    const result = await quickSavePosting(
      db,
      "user-1",
      { url: "https://jobs.example.com/5", category: "planning" },
      today,
      async () => ({}),
    );
    expect(result).toMatchObject({ ok: true, data: { category: "applied", outcome: "already" } });
    expect(updates).toHaveLength(0);
  });

  it("rejects pages without a web link", async () => {
    const { db } = fakeDb([]);
    for (const url of ["", "file:///C:/job.html", "javascript:alert(1)"]) {
      const result = await quickSavePosting(db, "user-1", { url }, today, async () => ({}));
      expect(result.ok).toBe(false);
    }
  });
});
