import type { Enums } from "@/lib/supabase/database.types";

export type VisaSponsorship = Enums<"visa_sponsorship">;

/**
 * How a posting's visa sponsorship is judged from its description:
 *
 * - **no**: it says sponsorship isn't offered, or requires citizenship,
 *   permanent residency or a security clearance.
 * - **yes**: it says sponsorship is offered.
 * - **highly_likely**: no promise, but it welcomes students on visas (CPT/OPT,
 *   F-1, international students) or offers immigration/visa support.
 * - **maybe**: it says sponsorship may be possible, says nothing about it, or
 *   says contradictory things.
 */

/** Explicitly no sponsorship, or only citizens / residents / clearance holders. */
const NO_PATTERNS: RegExp[] = [
  // "we are unable to sponsor", "will not sponsor", "cannot sponsor", "not be able to sponsor"
  /\b(?:unable|not able|cannot|can ?not|can't|won't|will not|do not|don't|does not|doesn't|are not|is not|'re not|'s not)\s+(?:\w+\s+){0,3}?sponsor/,
  // "not open to candidates who require visa sponsorship"
  /\bnot\s+open\s+to\s+(?:\w+\s+){0,3}?(?:requir|need)\w*\s+(?:[\w/-]+\s+){0,2}?sponsorship\b/,
  // "does not offer visa sponsorship", "unable to provide relocation or sponsorship"
  /\b(?:not|unable to|cannot|can't)\s+(?:\w+\s+){0,2}?(?:offer|provide|support|extend)\w*\s+(?:[\w/-]+\s+){0,4}?sponsorship/,
  // "no visa sponsorship", "no sponsorship is available"
  /\bno\s+(?:[\w/-]+\s+){0,2}?sponsorship\b/,
  // "sponsorship is not available", "sponsorship will not be provided", "sponsorship unavailable"
  /\bsponsorship\s+(?:\w+\s+){0,2}?(?:not|unavailable)\b/,
  // "authorized to work ... without (the need for) (current or future) (visa) sponsorship"
  /(?<!with or )\bwithout\s+(?:\w+\s+){0,8}?sponsorship\b/,
  // "not eligible for visa sponsorship", "not be considered ... requiring sponsorship"
  /\bnot\s+(?:be\s+)?eligible\s+for\s+(?:[\w/-]+\s+){0,2}?sponsorship\b/,
  /\b(?:not|cannot|unable to)\s+(?:be\s+)?consider\w*\s+[^.;]{0,60}?\bsponsorship\b/,
  // Citizenship / permanent residency / clearance requirements.
  /\b(?:must|required to)\s+be\s+(?:an?\s+)?(?:u\.?s\.?|united states|american|canadian)\s+citizens?\b/,
  /\b(?:u\.?s\.?|united states|american|canadian)\s+citizenship\s+(?:is\s+)?(?:required|mandatory)\b/,
  /\b(?:only\s+)?(?:u\.?s\.?|canadian)\s+citizens?\s+(?:and|or)\s+(?:lawful\s+)?permanent\s+residents?\s+(?:only|are\s+eligible)\b/,
  /\bcitizens?\s+(?:and|or)\s+(?:lawful\s+)?permanent\s+residents?\s+only\b/,
  /\bmust\s+be\s+a\s+u\.?s\.?\s+person\b/,
  /(?<!no )\bsecurity\s+clearance\s+(?:is\s+)?required\b/,
  /\bmust\s+(?:be\s+able\s+to\s+)?(?:obtain|hold|have|possess|maintain)(?:\s+(?:and|or)\s+(?:obtain|hold|have|possess|maintain))?\s+(?:an?\s+)?(?:active\s+|current\s+)?(?:[\w/-]+\s+){0,2}?(?:security\s+)?clearance\b/,
  // "international students are not eligible", "not open to international students"
  /\binternational\s+students\s+(?:are\s+)?not\s+eligible\b/,
  /\bnot\s+open\s+to\s+international\s+students\b/,
  /\b(?:cpt|opt)\b[^.;]{0,30}?\bnot\s+(?:accepted|supported|eligible|sponsored)\b/,
];

/** Explicitly offers sponsorship. */
const YES_PATTERNS: RegExp[] = [
  // "visa sponsorship is available", "H-1B sponsorship provided"
  /\b(?:visa|immigration|h-?1b|work\s+permit|work\s+visa|employment\s+visa)\s+sponsorship\s+(?:is\s+|will\s+be\s+|can\s+be\s+)?(?:available|provided|offered|supported)\b/,
  /\bsponsorship\s+(?:is\s+|will\s+be\s+|can\s+be\s+)?(?:available|provided|offered)\b/,
  // "we offer visa sponsorship", "will provide immigration sponsorship"
  /\b(?:offer|offers|provide|provides)\s+(?:\w+\s+){0,2}?(?:visa|immigration|h-?1b|work\s+permit)\s+sponsorship\b/,
  // "we sponsor visas", "will sponsor work permits"
  /\bsponsors?\s+(?:\w+\s+){0,2}?(?:visas|h-?1bs?|work\s+permits?|green\s+cards?)\b/,
  /\b(?:willing|able|happy|pleased|glad)\s+to\s+sponsor\b/,
  /\bwill\s+sponsor\b/,
  // "open to candidates who require sponsorship", "eligible for visa sponsorship"
  /\bopen\s+to\s+(?:\w+\s+){0,3}?(?:requir|need)\w*\s+(?:[\w/-]+\s+){0,2}?sponsorship\b/,
  /\beligible\s+for\s+(?:visa\s+|h-?1b\s+|immigration\s+)?sponsorship\b/,
];

/** Sponsorship is possible but not promised. */
const MAYBE_PATTERNS: RegExp[] = [
  /\bsponsorship\s+(?:\w+\s+){0,2}?(?:may|might|could)\s+be\s+(?:available|considered|provided|offered)\b/,
  /\bsponsorship\s+[^.;]{0,40}?\bcase[- ]by[- ]case\b/,
  /\bcase[- ]by[- ]case\b[^.;]{0,40}?\bsponsorship\b/,
];

/** Signs the employer hires people on visas, without promising sponsorship. */
const LIKELY_PATTERNS: RegExp[] = [
  /\b(?:cpt|opt)\s*(?:\/|or|and|,)\s*(?:stem\s+)?(?:cpt|opt)\b/,
  /\bstem\s+opt\b/,
  /\b(?:curricular|optional)\s+practical\s+training\b/,
  /\bf-?1\s+(?:students?|visas?|status)\b/,
  /\binternational\s+(?:students|candidates|applicants)\s+(?:are\s+)?(?:(?!not\b)\w+\s+)?(?:welcome|encouraged|eligible)\b/,
  // Not "services": "U.S. Citizenship and Immigration Services" is in E-Verify notices.
  /\b(?:immigration|visa|work\s+permit)\s+(?:support|assistance)\b/,
];

/** Words just before a match that flip its meaning ("not eligible for sponsorship"). */
const NEGATION_BEFORE = /\b(?:not|no|unable|cannot|never|nor|\w+n't)(?![\w'])[^.;:!?]{0,30}$/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[‐-―]/g, "-").replace(/\s+/g, " ");
}

function matches(text: string, patterns: RegExp[], { negatable }: { negatable: boolean }) {
  return patterns.some((pattern) => {
    for (const match of text.matchAll(new RegExp(pattern.source, "g"))) {
      if (!negatable) return true;
      const before = text.slice(Math.max(0, match.index - 40), match.index);
      if (!NEGATION_BEFORE.test(before)) return true;
    }
    return false;
  });
}

/**
 * Judges sponsorship from a job description. `complete` says whether this is
 * the whole description: only then does saying nothing mean "maybe"; for a
 * short snippet (a page's meta description) with no mention, the answer is
 * undefined rather than a guess.
 */
export function classifyVisaSponsorship(
  description: string | undefined,
  { complete }: { complete: boolean },
): VisaSponsorship | undefined {
  const text = normalize(description ?? "");
  if (!text.trim()) return undefined;

  const no = matches(text, NO_PATTERNS, { negatable: false });
  const yes = matches(text, YES_PATTERNS, { negatable: true });
  const maybe = matches(text, MAYBE_PATTERNS, { negatable: false });
  const likely = matches(text, LIKELY_PATTERNS, { negatable: true });

  // Contradictory statements can't be settled automatically.
  if (no && (yes || likely || maybe)) return "maybe";
  if (no) return "no";
  if (yes) return "yes";
  if (maybe) return "maybe";
  if (likely) return "highly_likely";
  return complete ? "maybe" : undefined;
}
