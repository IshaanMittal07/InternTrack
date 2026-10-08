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

function cleanDescription(value: unknown): string | undefined {
  const source = text(value);
  if (!source) return undefined;
  const content = load(source).text().replace(/\s+/g, " ").trim();
  return content.slice(0, 10_000) || undefined;
}

export function parsePostingHtml(html: string): PostingDetails {
  const $ = load(html);
  for (const element of $('script[type="application/ld+json"]').toArray()) {
    try {
      const job = findJobPosting(JSON.parse($(element).text()));
      if (!job) continue;

      const result: PostingDetails = {};
      const company = text(asRecord(job.hiringOrganization)?.name);
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