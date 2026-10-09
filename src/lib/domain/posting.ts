import { load } from "cheerio";

export type PostingDetails = {
  company?: string;
  role_title?: string;
  location?: string;
  deadline?: string;
  posting_notes?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }

  const record = asRecord(value);
  if (!record) return null;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  if (types.includes("JobPosting")) return record;

  for (const item of Object.values(record)) {
    const found = findJobPosting(item);
    if (found) return found;
  }
  return null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nestedName(value: unknown): string | undefined {
  return text(value) ?? text(asRecord(value)?.name);
}

function jobLocation(value: unknown): string | undefined {
  const firstLocation = Array.isArray(value) ? value[0] : value;
  const address = asRecord(asRecord(firstLocation)?.address);
  if (!address) return undefined;

  const country = nestedName(address.addressCountry);
  const parts = [address.addressLocality, address.addressRegion, country]
    .map(text)
    .filter((part): part is string => Boolean(part));
  return parts.length ? [...new Set(parts)].join(", ") : undefined;
}

function dateOnly(value: unknown): string | undefined {
  const source = text(value);
  if (!source) return undefined;
  const datePart = source.match(/^\d{4}-\d{2}-\d{2}(?=$|T)/)?.[0];
  if (datePart) {
    const parsedDate = new Date(`${datePart}T00:00:00.000Z`);
    return Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== datePart
      ? undefined
      : datePart;
  }
  const date = new Date(source);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString().slice(0, 10);
}

/** Text of an HTML fragment, keeping a space where line breaks and blocks end. */
function htmlToText(html: string): string {
  return load(html.replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, " $&")).text();
}

function cleanDescription(value: unknown): string | undefined {
  const source = text(value);
  if (!source) return undefined;
  let content = htmlToText(source);
  // Some sites (LinkedIn, Greenhouse) HTML-escape the description HTML, so
  // one pass leaves literal tags behind; strip them with a second pass.
  if (/<[a-z/][^>]*>/i.test(content)) content = htmlToText(content);
  content = content.replace(/\s+/g, " ").trim();
  return content.slice(0, 10_000) || undefined;
}

export function parsePostingHtml(html: string): PostingDetails {
  const $ = load(html);
  for (const element of $('script[type="application/ld+json"]').toArray()) {
    try {
      const job = findJobPosting(JSON.parse($(element).text()));
      if (!job) continue;

      const result: PostingDetails = {};
      // hiringOrganization is usually an object, but some sites give a plain name.
      const company = nestedName(job.hiringOrganization);
      const role = text(job.title);
      const location = jobLocation(job.jobLocation);
      const deadline = dateOnly(job.validThrough);
      const notes = cleanDescription(job.description);
      if (company) result.company = company;
      if (role) result.role_title = role;
      if (location) result.location = location;
      if (deadline) result.deadline = deadline;
      if (notes) result.posting_notes = notes;
      return result;
    } catch {
      // Continue to the next JSON-LD block or metadata fallback.
    }
  }

  const result: PostingDetails = {};
  const company = text($('meta[property="og:site_name"]').attr("content"));
  const role =
    text($('meta[property="og:title"]').attr("content")) ?? text($("title").first().text());
  const notes =
    text($('meta[property="og:description"]').attr("content")) ??
    text($('meta[name="description"]').attr("content"));
  if (company) result.company = company;
  if (role) result.role_title = role;
  if (notes) result.posting_notes = cleanDescription(notes);
  return result;
}
const GREENHOUSE_HOSTS = new Set(["boards.greenhouse.io", "job-boards.greenhouse.io"]);

/**
 * The public Greenhouse job API URL for a Greenhouse posting link, or null.
 * Handles `/{board}/jobs/{id}` and `/embed/job_app?for={board}&token={id}`.
 */
export function greenhouseApiUrl(source: string): string | null {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return null;
  }
  if (!GREENHOUSE_HOSTS.has(url.hostname)) return null;

  const path = url.pathname.match(/^\/([\w-]+)\/jobs\/(\d+)/);
  const board = path?.[1] ?? url.searchParams.get("for");
  const id = path?.[2] ?? url.searchParams.get("token");
  if (!board || !id || !/^[\w-]+$/.test(board) || !/^\d+$/.test(id)) return null;
  return `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`;
}

/** Maps a Greenhouse job API response to posting details. */
export function parseGreenhouseJob(value: unknown): PostingDetails {
  const job = asRecord(value);
  if (!job) return {};

  const result: PostingDetails = {};
  const company = text(job.company_name);
  const role = text(job.title);
  const location = text(asRecord(job.location)?.name);
  const deadline = dateOnly(job.application_deadline);
  const notes = cleanDescription(job.content);
  if (company) result.company = company;
  if (role) result.role_title = role;
  if (location) result.location = location;
  if (deadline) result.deadline = deadline;
  if (notes) result.posting_notes = notes;
  return result;
}

function parseUrl(source: string): URL | null {
  try {
    return new URL(source);
  } catch {
    return null;
  }
}

/** Lever's `/apply` page has no job metadata; the posting page itself does. */
export function leverPostingUrl(source: string): string {
  const url = parseUrl(source);
  if (url?.hostname !== "jobs.lever.co") return source;
  url.pathname = url.pathname.replace(/\/apply\/?$/, "");
  return url.toString();
}

/** Workable's public account API, which holds the company name. */
export function workableAccountApiUrl(source: string): string | null {
  const url = parseUrl(source);
  const account = url?.hostname === "apply.workable.com" && url.pathname.split("/")[1];
  return account && /^[\w-]+$/.test(account)
    ? `https://apply.workable.com/api/v1/accounts/${account}`
    : null;
}

export function parseWorkableAccount(value: unknown): string | undefined {
  return text(asRecord(value)?.name);
}

/**
 * The sidebar API of a Workday career site. Its job pages often leave the
 * company name empty, but the sidebar's logo usually carries it as alt text.
 */
export function workdaySidebarUrl(source: string): string | null {
  const url = parseUrl(source);
  if (!url?.hostname.endsWith(".myworkdayjobs.com")) return null;
  const tenant = url.hostname.split(".")[0];
  // Paths look like /[en-US/]{site}/job/...
  const site = url.pathname
    .split("/")
    .filter(Boolean)
    .find((part) => !/^[a-z]{2}-[A-Z]{2}$/.test(part));
  if (!tenant || !site || site === "job" || !/^[\w-]+$/.test(tenant + site)) return null;
  return `https://${url.hostname}/wday/cxs/${tenant}/${site}/sidebar`;
}

export function parseWorkdaySidebar(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    // "Acme logo" -> "Acme"; alt text that is only "Logo" or "Image" says nothing.
    const alt = text(asRecord(item)?.altText)
      ?.replace(/\s*(company\s+)?logo$/i, "")
      .trim();
    if (alt && alt.length <= 60 && !/^(logo|image|banner|header|picture)$/i.test(alt)) return alt;
  }
  return undefined;
}

// Job sites whose first path segment is the company, e.g. jobs.lever.co/viget/...
const SLUG_IN_PATH = new Set([
  "jobs.lever.co",
  "jobs.ashbyhq.com",
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "apply.workable.com",
  "jobs.smartrecruiters.com",
  "jobs.jobvite.com",
]);
// Job sites whose subdomain is the company, e.g. modmed.wd5.myworkdayjobs.com.
const SLUG_IN_SUBDOMAIN = [
  ".myworkdayjobs.com",
  ".icims.com",
  ".bamboohr.com",
  ".applytojob.com",
  ".breezy.hr",
  ".recruitee.com",
  ".teamtailor.com",
];

// Hosts shared by many employers, where the domain says nothing about the company.
const PLATFORM_DOMAINS = [
  "oraclecloud.com",
  "taleo.net",
  "successfactors.com",
  "successfactors.eu",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "simplify.jobs",
  "ziprecruiter.com",
  "joinhandshake.com",
  "wellfound.com",
  "dice.com",
  "monster.com",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workable.com",
  "smartrecruiters.com",
];

function titleCase(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

/** A best guess at the company from the link alone, when the page doesn't say. */
export function companyFromUrl(source: string): string | undefined {
  const url = parseUrl(source);
  if (!url) return undefined;
  const host = url.hostname.toLowerCase();

  let slug: string | undefined;
  if (SLUG_IN_PATH.has(host)) {
    slug = url.pathname.split("/")[1];
    if (host === "boards.greenhouse.io" && slug === "embed") {
      slug = url.searchParams.get("for") ?? undefined;
    }
  } else if (SLUG_IN_SUBDOMAIN.some((suffix) => host.endsWith(suffix))) {
    slug = host.split(".")[0]?.replace(/^(careers|jobs)-|-(careers|jobs)$/g, "");
  } else if (PLATFORM_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    return undefined;
  } else {
    // careers.acme.com, jobs.acme.co.uk, acme.com/careers -> "acme"
    const labels = host.split(".").filter((label) => !/^(www|careers?|jobs?|apply)$/.test(label));
    slug = labels.length > 2 && labels.at(-2)!.length <= 3 ? labels.at(-3) : labels.at(-2);
  }
  return slug && /^[\w-]+$/.test(slug) ? titleCase(slug) : undefined;
}

const SITE_SUFFIX = /(\.jobs|\.careers|\s+(external\s+)?(careers?|jobs)(\s+(site|page|portal))?)$/i;
const LEGAL_SUFFIX =
  /,?\s+(inc\.?|llc|l\.l\.c\.|ltd\.?|limited|corp\.?|corporation|gmbh|plc|s\.a\.|b\.v\.|ag)$/i;

/** "Amazon.jobs" -> "Amazon", "WTW External Careers Site" -> "WTW", "GM LLC" -> "GM". */
export function cleanCompanyName(name: string): string {
  let cleaned = name.trim();
  for (const suffix of [SITE_SUFFIX, LEGAL_SUFFIX, LEGAL_SUFFIX]) {
    const next = cleaned.replace(suffix, "").trim();
    if (next) cleaned = next;
  }
  return cleaned;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Drops the company from page titles like "Intern - Acme" or "Acme - Intern". */
export function cleanRoleTitle(role: string, company: string | undefined): string {
  if (!company) return role;
  const name = escapeRegExp(company);
  const cleaned = role
    .replace(new RegExp(`\\s*(?:[-|–—:]|\\bat)\\s*${name}\\s*$`, "i"), "")
    .replace(new RegExp(`^\\s*${name}\\s*[-|–—:]\\s*`, "i"), "")
    .trim();
  return cleaned || role;
}
