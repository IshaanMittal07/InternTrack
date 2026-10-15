/**
 * Decides whether an email is an application rejection, from its wording.
 *
 * Deliberately cautious: a wrong "rejected" is worse than a missed one, so it
 * needs one unmistakable rejection phrase (not inside an "if ..." clause), or
 * three softer signals plus a mention of the application. Anything that
 * sounds like good news (an offer, an interview invitation) is never treated
 * as a rejection.
 */

/** Lowercase, straight quotes, single spaces: what the patterns expect. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Drops quoted earlier messages from a reply, so a rejection quoted in some
 * later email (or the user's own text quoted back) is not read as new.
 */
export function stripQuotedText(body: string): string {
  const cut = body.search(
    /^\s*(?:-{2,}\s*(?:original|forwarded) message\s*-{2,}|on .{1,200}wrote:\s*$|from: .+\r?\nsent: )/im,
  );
  const kept = cut === -1 ? body : body.slice(0, cut);
  return kept
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
}

const MOVE = "(?:move|moving|proceed|proceeding|progress|progressing|advance|advancing)";
const OTHERS =
  "(?:other|another|different|alternative) (?:candidates?|applicants?|individuals?|profiles?)";
const WILL_NOT =
  "(?:will not|won't|would not|wouldn't|cannot|can't|can not|are not|aren't|unable to|not able to|not be able to)";

/** Each one alone is enough (unless it sits in an "if ..." clause). */
const STRONG: RegExp[] = [
  // "we will not be moving forward with your application", "unable to proceed with your candidacy"
  new RegExp(
    `\\b${WILL_NOT}(?: be)? ${MOVE}(?: forward| further| ahead)? with (?:your|you)\\b`,
    "g",
  ),
  // "we've decided not to move forward (with your application)"
  new RegExp(
    `\\b(?:decided|chosen|elected) (?:not to|to not) ${MOVE}(?: forward| further| ahead)? with (?:your|you)\\b`,
    "g",
  ),
  new RegExp(`\\b(?:decided|chosen|elected) (?:not to|to not) ${MOVE} forward\\b`, "g"),
  // "you will not be moving on to the next round"
  /\bnot (?:be )?(?:moving|advancing|progressing|proceeding)(?: on| forward)? to the next (?:round|stage|step|phase)\b/g,
  // "we have decided to move forward with other candidates", "go with another candidate"
  /\b(?:move|moving|proceed|proceeding|go|going|continue|continuing)(?: forward)? with (?:other|another|different|alternative) (?:candidates?|applicants?|individuals?|profiles?)\b/g,
  new RegExp(`\\bpursu(?:e|ing) ${OTHERS}\\b`, "g"),
  // "candidates whose experience more closely matches"
  /\bcandidates? whose (?:[a-z']+ ){1,5}(?:more|better|most) (?:closely )?(?:match|matches|matched|align|aligns|aligned|fit|fits|meet|meets)\b/g,
  // "you have not been selected", "you weren't selected for the role"
  /\bnot been selected\b/g,
  /(?:\bnot|n't) selected (?:for|to (?:move|proceed|advance|continue|interview))\b/g,
  // "the position has been filled"
  /\b(?:position|role|positions|roles|opening|vacancy) (?:has|have) (?:now |already )?been filled\b/g,
  // "we are unable to offer you a position", "we will not be extending an offer"
  /\b(?:unable|not able) to offer you\b/g,
  /\bnot (?:be )?(?:offering|extending|making) (?:you )?(?:an? |the )?(?:offer|position|role|internship)\b/g,
  /\b(?:application|candidacy) (?:was|has been|is|were|have been) unsuccessful\b/g,
  /\b(?:application|candidacy) (?:was|has|is|were|have)(?: not|n't) (?:been )?successful\b/g,
  /\bunsuccessful (?:on this occasion|at this time|this time)\b/g,
  // "your application is no longer under consideration"
  /\bno longer (?:being )?(?:under consideration|considering your|considered for)\b/g,
  /\bwill not be (?:considered|considering you|considering your)\b/g,
];

/** Softer signals: three of them, plus a mention of the application. */
const WEAK: RegExp[] = [
  /\bunfortunately\b/,
  /\bregret to (?:inform|let you know|advise|tell)\b/,
  /\bafter (?:careful|thorough|much) (?:consideration|review|deliberation)\b/,
  /\b(?:keep|retain|hold) your (?:resume|cv|information|profile|application|details)\b/,
  /\bencourage you to (?:re-?apply|apply (?:again|in the future|for future|to future|for other)|keep an eye|continue to (?:check|monitor|explore))\b/,
  /\bwish you (?:the (?:very )?best|success|all the best|every success|luck|best of luck|well)\b/,
  /\b(?:go|went|move|moving) in a different direction\b/,
  /\b(?:highly|very|extremely) competitive\b/,
  /\b(?:large|high|significant|overwhelming) (?:number|volume) of (?:applicants|applications|candidates|qualified)\b/,
];

const ABOUT_APPLICATION =
  /\b(?:your application|your candidacy|your interest in|applying (?:to|for)|you applied)\b/;

/** Good news. If any of these appear, it is not treated as a rejection. */
const GOOD_NEWS: RegExp[] = [
  /\bcongratulations\b/,
  /\b(?:pleased|happy|delighted|excited|thrilled) to (?:offer|extend|invite|inform you that you|let you know that you|move you)\b/,
  /\boffer letter\b/,
  /\b(?:schedule|book|set up|arrange) (?:an?|your|the) (?:interview|call|chat|phone screen|meeting)\b/,
  /\binvite you to (?:an?|the|our|participate|complete|take)\b/,
  /\b(?:move|moving|advance|advancing) you (?:forward|to the next|on to)\b/,
  /\b(?:like|love) to (?:move forward with you|invite you|offer you|schedule)\b/,
];

/** Words that make the rest of their sentence hypothetical. */
const CONDITIONAL = /\b(?:if|unless|whether|in case|should you)\b/;

/** True if `re` matches somewhere that is not inside an "if ..." sentence. */
function matchesOutsideConditional(re: RegExp, text: string): boolean {
  for (const match of text.matchAll(re)) {
    const before = text.slice(0, match.index);
    const sentenceStart = Math.max(
      before.lastIndexOf(". "),
      before.lastIndexOf("! "),
      before.lastIndexOf("? "),
      before.lastIndexOf("; "),
    );
    if (!CONDITIONAL.test(before.slice(sentenceStart + 1))) return true;
  }
  return false;
}

export function isRejection(email: { subject: string; body: string }): boolean {
  const text = normalizeText(`${email.subject}. ${stripQuotedText(email.body)}`);
  if (GOOD_NEWS.some((re) => re.test(text))) return false;
  if (STRONG.some((re) => matchesOutsideConditional(re, text))) return true;
  const weak = WEAK.filter((re) => re.test(text)).length;
  return weak >= 3 && ABOUT_APPLICATION.test(text);
}
