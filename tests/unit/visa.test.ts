import { describe, expect, it } from "vitest";

import { classifyVisaSponsorship } from "@/lib/domain/visa";

const full = (text: string) => classifyVisaSponsorship(text, { complete: true });
const snippet = (text: string) => classifyVisaSponsorship(text, { complete: false });

const INTRO = "We're hiring a Software Engineering Intern to build payments infrastructure. ";

describe("classifyVisaSponsorship: no", () => {
  it.each([
    "We are unable to sponsor or take over sponsorship of an employment visa at this time.",
    "Candidates must be authorized to work in the United States without the need for current or future visa sponsorship.",
    "Applicants must be legally authorized to work in the U.S. without sponsorship.",
    "This position is not eligible for visa sponsorship.",
    "We do not offer visa sponsorship for this role.",
    "Company will not sponsor applicants for work visas.",
    "No visa sponsorship is available for this position.",
    "Sponsorship is not available for this role.",
    "Visa sponsorship will not be provided.",
    "We cannot sponsor visas now or in the future.",
    "Must be a U.S. citizen due to government contract requirements.",
    "U.S. citizenship is required.",
    "Open to Canadian citizens or permanent residents only.",
    "US Citizens and Permanent Residents only.",
    "Must be able to obtain and maintain a Secret security clearance.",
    "Active security clearance required.",
    "International students are not eligible for this program.",
    "We are not able to provide relocation or sponsorship.",
    "Applicants requiring sponsorship will not be considered.",
    "Must be a U.S. person as defined by ITAR.",
    "We're not sponsoring visas for this role.",
    "We are not currently sponsoring work visas.",
    "This role is not open to candidates who require visa sponsorship.",
    "We don't sponsor visas.",
  ])("%s", (sentence) => {
    expect(full(INTRO + sentence)).toBe("no");
  });
});

describe("classifyVisaSponsorship: yes", () => {
  it.each([
    "Visa sponsorship is available for this position.",
    "We offer visa sponsorship.",
    "H-1B sponsorship available for qualified candidates.",
    "We sponsor visas and green cards.",
    "We are happy to sponsor visas for the right candidate.",
    "Our company will sponsor work permits where needed.",
    "This role is open to candidates who require visa sponsorship.",
    "This role is eligible for visa sponsorship.",
  ])("%s", (sentence) => {
    expect(full(INTRO + sentence)).toBe("yes");
  });
});

describe("classifyVisaSponsorship: highly likely", () => {
  it.each([
    "Students on CPT/OPT are encouraged to apply.",
    "OPT or CPT candidates welcome.",
    "STEM OPT extension supported.",
    "Curricular Practical Training (CPT) available for eligible students.",
    "F-1 students are welcome to apply.",
    "International students are welcome to apply.",
    "We provide immigration support for new hires.",
  ])("%s", (sentence) => {
    expect(full(INTRO + sentence)).toBe("highly_likely");
  });
});

describe("classifyVisaSponsorship: maybe", () => {
  it("is maybe when a full description never mentions it", () => {
    expect(full(INTRO + "You'll work with Go and Postgres. Benefits include free lunch.")).toBe(
      "maybe",
    );
  });

  it.each([
    "Visa sponsorship may be available for exceptional candidates.",
    "Sponsorship is considered on a case-by-case basis.",
  ])("is maybe when sponsorship is possible but not promised: %s", (sentence) => {
    expect(full(INTRO + sentence)).toBe("maybe");
  });

  it("is maybe when the description contradicts itself", () => {
    expect(
      full(INTRO + "We are unable to sponsor visas. Visa sponsorship is available for some roles."),
    ).toBe("maybe");
  });
});

describe("classifyVisaSponsorship: phrases that must not be misread", () => {
  it("is not fooled by unrelated negations or wording", () => {
    // Negated offers are not a yes...
    expect(full("We don't provide visa support.")).toBe("maybe");
    // ...a "with or without" is not a no...
    expect(full("Candidates with or without sponsorship needs are welcome to apply.")).toBe(
      "maybe",
    );
    // ...nor is "no clearance required"...
    expect(full("No security clearance required.")).toBe("maybe");
    // ...nor the E-Verify notice...
    expect(
      full(
        "This employer participates in E-Verify and will provide the U.S. Citizenship and Immigration Services with your I-9 information.",
      ),
    ).toBe("maybe");
    // ...nor "opt in" / "F1 score"...
    expect(full("You can opt in to our wellness program. Experience with F1 score metrics.")).toBe(
      "maybe",
    );
    // ...nor just needing to be authorized to work.
    expect(full("Must be authorized to work in Canada.")).toBe("maybe");
  });

  it("does not let a negation in an earlier sentence flip a later one", () => {
    expect(full("Not sure you qualify? Apply anyway! Visa sponsorship is available.")).toBe("yes");
  });

  it("handles typographic quotes and dashes", () => {
    expect(full("We can’t sponsor visas.")).toBe("no");
    expect(full("H‑1B sponsorship available.")).toBe("yes");
  });

  it("reads statements at the end of a long description", () => {
    expect(full(`${INTRO.repeat(400)}We are unable to sponsor visas.`)).toBe("no");
  });
});

describe("classifyVisaSponsorship: snippets", () => {
  it("only answers for an explicit statement", () => {
    expect(snippet("Join our team as an intern in Toronto.")).toBeUndefined();
    expect(snippet("Visa sponsorship available.")).toBe("yes");
    expect(snippet("No sponsorship.")).toBe("no");
  });

  it("returns undefined for no text", () => {
    expect(full("")).toBeUndefined();
    expect(full("   ")).toBeUndefined();
  });
});
