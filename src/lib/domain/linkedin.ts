import { nameWords } from "@/lib/email/match";

/** What the "Add LinkedIn contact" bookmark read from the profile page. */
export type RawProfile = {
  url?: string | undefined;
  /** The profile's main heading. */
  name?: string | undefined;
  /** The line under the name, e.g. "Recruiter at Shopify". */
  headline?: string | undefined;
  /** The top card's current company, e.g. "Current company: Shopify. Click to skip…". */
  company?: string | undefined;
  /** document.title, e.g. "(3) Jane Doe | LinkedIn". */
  title?: string | undefined;
};

export type ProfileDetails = {
  name: string;
  title: string;
  company: string;
  linkedin_url: string;
};

/** Same limits as the contact form. */
const NAME_MAX = 120;
const TITLE_MAX = 120;

function clean(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * The plain profile link, e.g. https://www.linkedin.com/in/jane-doe/, or ""
 * if `url` is not a LinkedIn profile. Drops query strings and sub-pages such
 * as /overlay/contact-info or /details/experience.
 */
export function canonicalLinkedInProfileUrl(url: string | undefined): string {
  let parsed: URL;
  try {
    parsed = new URL(clean(url));
  } catch {
    return "";
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return "";
  const [, section, slug] = parsed.pathname.split("/");
  if (section !== "in" || !slug) return "";
  return `https://www.linkedin.com/in/${slug}/`;
}

/** "Current company: Shopify. Click to skip to experience card" -> "Shopify". */
function companyFromLabel(label: string): string {
  return label
    .replace(/^current company:\s*/i, "")
    .replace(/\.\s*click to skip.*$/i, "")
    .trim();
}

/** "Recruiter at Shopify | Hiring interns" -> role "Recruiter", company "Shopify". */
function splitHeadline(headline: string): { role: string; company: string } {
  const first = headline.split(/\s+[|•·]\s+/)[0] ?? "";
  const match = first.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i) ?? first.match(/^(.+?)\s*@\s*(.+)$/);
  if (!match) return { role: first, company: "" };
  return { role: match[1]!.trim(), company: match[2]!.trim() };
}

/** "(3) Jane Doe | LinkedIn" -> "Jane Doe". */
function nameFromTitle(title: string): string {
  return title
    .replace(/^\(\d+\+?\)\s*/, "")
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .split(/\s+[-–]\s+/)[0]!
    .trim();
}

/** Turns what the bookmark read into contact fields, filling gaps from each other. */
export function parseLinkedInProfile(raw: RawProfile): ProfileDetails {
  const headline = clean(raw.headline);
  const split = splitHeadline(headline);
  const company = companyFromLabel(clean(raw.company)) || split.company;
  const name = clean(raw.name) || nameFromTitle(clean(raw.title));
  // The headline's role when it names the company ("Recruiter at Shopify"),
  // otherwise the whole first part ("Software Engineer").
  const title = split.role || headline;
  return {
    name: clip(name, NAME_MAX),
    title: clip(title, TITLE_MAX),
    company,
    linkedin_url: canonicalLinkedInProfileUrl(raw.url),
  };
}

/** True if the two company names refer to the same company ("Shopify Inc." vs "Shopify"). */
export function sameCompany(a: string, b: string): boolean {
  const x = nameWords(a).join(" ");
  const y = nameWords(b).join(" ");
  if (!x || !y) return false;
  return x === y || ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `);
}
