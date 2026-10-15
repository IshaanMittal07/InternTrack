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
  /** JSON: the text lines of each Experience entry, newest first. */
  experience?: string | undefined;
};

/** One job from the Experience section. */
export type Experience = { role: string; company: string };

export type ProfileDetails = {
  name: string;
  /** Their current role: from Experience when it has one, else the headline. */
  title: string;
  company: string;
  linkedin_url: string;
  /** Newest first, for picking their role at a given posting's company. */
  experience: Experience[];
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

/** "Jan 2024 - Present · 1 yr 10 mos" or "2022 – 2023": the line under each role. */
function isDateRange(line: string): boolean {
  return /\b(?:19|20)\d{2}\b/.test(line) && /[-–]|present/i.test(line);
}

/**
 * One Experience entry's text lines -> its newest role. A single role reads
 * [Role, "Company · Full-time", dates, ...]; several roles at one company read
 * [Company, "Full-time · 3 yrs", (location), Role, dates, ...], so there the
 * role is the line just above the first date range.
 */
function parseExperienceEntry(lines: string[]): Experience | null {
  const d = lines.findIndex(isDateRange);
  if (d < 1) return null;
  const grouped = d >= 3;
  const role = grouped ? lines[d - 1]! : lines[0]!;
  const company = grouped ? lines[0]! : d === 2 ? lines[1]!.split(" · ")[0]!.trim() : "";
  return role && role !== company ? { role, company } : null;
}

/** The bookmark's Experience JSON -> roles, newest first. Anything malformed is ignored. */
export function parseExperience(json: string | undefined): Experience[] {
  let entries: unknown;
  try {
    entries = JSON.parse(json ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, 10).flatMap((entry) => {
    if (!Array.isArray(entry)) return [];
    const lines = entry.filter((l): l is string => typeof l === "string").map(clean);
    const parsed = parseExperienceEntry(lines);
    return parsed ? [{ role: clip(parsed.role, TITLE_MAX), company: parsed.company }] : [];
  });
}

/** Their most recent role at `company`, if their Experience lists one. */
export function roleAt(experience: Experience[], company: string): string | undefined {
  return experience.find((e) => sameCompany(e.company, company))?.role;
}

/** Turns what the bookmark read into contact fields, filling gaps from each other. */
export function parseLinkedInProfile(raw: RawProfile): ProfileDetails {
  const headline = clean(raw.headline);
  const split = splitHeadline(headline);
  const experience = parseExperience(raw.experience);
  const company =
    companyFromLabel(clean(raw.company)) || split.company || experience[0]?.company || "";
  const name = clean(raw.name) || nameFromTitle(clean(raw.title));
  // Their role at their current company from Experience; failing that, the
  // headline's role when it names the company ("Recruiter at Shopify"),
  // otherwise the headline's first part ("Software Engineer").
  const title =
    (company && roleAt(experience, company)) || experience[0]?.role || split.role || headline;
  return {
    name: clip(name, NAME_MAX),
    title: clip(title, TITLE_MAX),
    company,
    linkedin_url: canonicalLinkedInProfileUrl(raw.url),
    experience,
  };
}

/** True if the two company names refer to the same company ("Shopify Inc." vs "Shopify"). */
export function sameCompany(a: string, b: string): boolean {
  const x = nameWords(a).join(" ");
  const y = nameWords(b).join(" ");
  if (!x || !y) return false;
  return x === y || ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `);
}
