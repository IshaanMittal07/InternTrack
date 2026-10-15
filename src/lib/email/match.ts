import type { Stage } from "@/lib/domain/constants";

import { stripQuotedText } from "./rejection";

/** Stages an email may move to Rejected. Offers, withdrawals etc. are never touched. */
export const ACTIVE_STAGES: readonly Stage[] = ["submitted", "online_assessment", "interviewing"];

export type AppliedPosting = {
  id: string;
  company: string;
  role_title: string | null;
  date_applied: string | null;
  application_stage: Stage | null;
};

export type MatchInput = {
  /** The From header, e.g. `Stripe Recruiting <no-reply@stripe.com>`. */
  from: string;
  subject: string;
  body: string;
  /** The day the email arrived, YYYY-MM-DD in the app's time zone. */
  receivedOn: string;
};

export type MatchResult =
  | { outcome: "rejected"; opportunityId: string }
  | { outcome: "skipped"; opportunityId: string; reason: "closed" | "before_applied" }
  | { outcome: "ambiguous" }
  | { outcome: "unmatched" };

/** Trailing words that are often left off a company's name in emails. */
const SUFFIXES = new Set([
  "inc",
  "incorporated",
  "llc",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "company",
  "plc",
  "gmbh",
  "ag",
  "sa",
  "holdings",
  "group",
  "technologies",
  "technology",
  "labs",
]);

/** A name as lowercase words: "Jane Street Capital, LLC" -> ["jane","street","capital"]. */
export function nameWords(name: string): string[] {
  const words = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words.at(-1)!)) words.pop();
  return words;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches the words as a whole phrase, whatever punctuation or spacing separates them. */
function phrasePattern(words: string[], flags: string): RegExp {
  const body = words.map(escapeRegExp).join("[^\\p{L}\\p{N}]+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, flags);
}

function containsPhrase(text: string, words: string[]): boolean {
  return words.length > 0 && phrasePattern(words, "iu").test(text.replace(/['’]/g, ""));
}

/**
 * In the body, a company name must be written with a capital letter, so a
 * company like "Ramp" or "Notion" is not found in "ramp up" or "the notion".
 */
function containsName(text: string, words: string[]): boolean {
  if (words.length === 0) return false;
  for (const match of text.replace(/['’]/g, "").matchAll(phrasePattern(words, "giu"))) {
    if (/\p{Lu}/u.test(match[0])) return true;
  }
  return false;
}

/** Splits a From header into display name and address. */
export function parseFrom(from: string): { name: string; address: string } {
  const [, name = "", address] = from.match(/^(.*)<([^>]+)>\s*$/) ?? [];
  if (address)
    return { name: name.replace(/"/g, "").trim(), address: address.trim().toLowerCase() };
  return { name: "", address: from.trim().toLowerCase() };
}

/** "stripe" in no-reply@stripe.com, careers@mail.stripe.com or stripe@myworkday.com. */
function addressMentions(address: string, words: string[]): boolean {
  const slug = words.join("");
  if (slug.length < 2) return false;
  const [local = "", domain = ""] = address.split("@");
  const labels = domain.split(".").slice(0, -1);
  return [...labels, ...local.split(/[.+_-]/)].some((part) => part === slug);
}

/** The single item, or undefined if there are none or several. */
function only<T>(items: T[]): T | undefined {
  return items.length === 1 ? items[0] : undefined;
}

/** True if `inner` appears as a whole run of words inside the longer `outer`. */
function isWordRunOf(inner: string[], outer: string[]): boolean {
  if (inner.length >= outer.length) return false;
  for (let i = 0; i + inner.length <= outer.length; i++) {
    if (inner.every((word, j) => outer[i + j] === word)) return true;
  }
  return false;
}

/**
 * Finds the one Applied posting a rejection email is about. Anything less
 * than a single clear answer is reported (ambiguous / unmatched) rather than
 * guessed.
 *
 * 1. The company must be named in the sender or subject (strong), or, if no
 *    company is, written in the body (weak). Only the strongest level counts.
 * 2. If one matched name contains another ("Google DeepMind" vs "Google"),
 *    the longer one wins. More than one company left is ambiguous.
 * 3. Postings applied to after the email arrived are ignored.
 * 4. Of that company's postings, the one still in progress is chosen. If
 *    several are, the role title named in the email decides; otherwise it is
 *    ambiguous.
 */
export function matchRejection(email: MatchInput, postings: AppliedPosting[]): MatchResult {
  const { name, address } = parseFrom(email.from);
  const body = stripQuotedText(email.body);

  const scored = postings.map((posting) => {
    const words = nameWords(posting.company);
    const strong =
      containsPhrase(name, words) ||
      containsPhrase(email.subject, words) ||
      addressMentions(address, words);
    const weak = !strong && containsName(body, words);
    return { posting, words, strong, weak };
  });

  const strong = scored.filter((s) => s.strong);
  let pool = strong.length > 0 ? strong : scored.filter((s) => s.weak);
  if (pool.length === 0) return { outcome: "unmatched" };

  pool = pool.filter((s) => !pool.some((other) => isWordRunOf(s.words, other.words)));
  const companies = new Set(pool.map((s) => s.words.join(" ")));
  if (companies.size > 1) return { outcome: "ambiguous" };

  const applied = pool.filter(
    (s) => !s.posting.date_applied || s.posting.date_applied <= email.receivedOn,
  );
  if (applied.length === 0) {
    const one = only(pool);
    return one
      ? { outcome: "skipped", opportunityId: one.posting.id, reason: "before_applied" }
      : { outcome: "ambiguous" };
  }

  const active = applied.filter(
    (s) => s.posting.application_stage && ACTIVE_STAGES.includes(s.posting.application_stage),
  );
  if (active.length === 0) {
    const one = only(applied);
    return one
      ? { outcome: "skipped", opportunityId: one.posting.id, reason: "closed" }
      : { outcome: "ambiguous" };
  }
  const activeOne = only(active);
  if (activeOne) return { outcome: "rejected", opportunityId: activeOne.posting.id };

  const text = `${email.subject}\n${body}`;
  const byRole = active
    .map((s) => ({ ...s, role: nameWords(s.posting.role_title ?? "") }))
    .filter((s) => s.role.length > 0 && containsPhrase(text, s.role));
  const roles = byRole.filter((s) => !byRole.some((other) => isWordRunOf(s.role, other.role)));
  const roleOne = only(roles);
  if (roleOne) return { outcome: "rejected", opportunityId: roleOne.posting.id };
  return { outcome: "ambiguous" };
}
