import { describe, expect, it } from "vitest";

import { isAllowedEmail, normalizeEmail } from "@/lib/auth/allowlist";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Me@Example.COM \n")).toBe("me@example.com");
  });
});

describe("isAllowedEmail", () => {
  const allowed = "me@example.com";

  it("accepts the allowed email in any case or surrounding whitespace", () => {
    expect(isAllowedEmail("me@example.com", allowed)).toBe(true);
    expect(isAllowedEmail(" ME@Example.com ", allowed)).toBe(true);
    expect(isAllowedEmail("me@example.com", "  ME@EXAMPLE.COM ")).toBe(true);
  });

  it("rejects any other email", () => {
    expect(isAllowedEmail("you@example.com", allowed)).toBe(false);
    expect(isAllowedEmail("me@example.com.evil.com", allowed)).toBe(false);
    expect(isAllowedEmail("me@example.co", allowed)).toBe(false);
  });

  it("fails closed on missing values", () => {
    expect(isAllowedEmail(undefined, allowed)).toBe(false);
    expect(isAllowedEmail(null, allowed)).toBe(false);
    expect(isAllowedEmail("", allowed)).toBe(false);
    expect(isAllowedEmail("me@example.com", "")).toBe(false);
    expect(isAllowedEmail("   ", "   ")).toBe(false);
  });
});
