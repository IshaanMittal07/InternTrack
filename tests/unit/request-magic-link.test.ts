import { describe, expect, it, vi } from "vitest";

import {
  INVALID_EMAIL_MESSAGE,
  SENT_MESSAGE,
  normalizeEmail,
  requestMagicLink,
} from "@/server/auth/request-magic-link";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Me@Example.COM \n")).toBe("me@example.com");
  });
});

describe("requestMagicLink", () => {
  it("sends a link to any valid email (normalized)", async () => {
    for (const [raw, expected] of [
      ["  ME@example.com ", "me@example.com"],
      ["someone.else@example.org", "someone.else@example.org"],
    ]) {
      const sendLink = vi.fn().mockResolvedValue({ error: null });
      const result = await requestMagicLink({ rawEmail: raw, sendLink, minDurationMs: 0 });
      expect(sendLink).toHaveBeenCalledWith(expected);
      expect(result).toEqual({ status: "sent", message: SENT_MESSAGE });
    }
  });

  it("gives the same answer even when sending fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sendLink = vi.fn().mockResolvedValue({ error: new Error("rate limited") });
    const result = await requestMagicLink({
      rawEmail: "me@example.com",
      sendLink,
      minDurationMs: 0,
    });
    expect(result).toEqual({ status: "sent", message: SENT_MESSAGE });
    spy.mockRestore();
  });

  it("takes at least the minimum duration", async () => {
    const start = performance.now();
    await requestMagicLink({
      rawEmail: "me@example.com",
      sendLink: async () => ({ error: null }),
      minDurationMs: 60,
    });
    expect(performance.now() - start).toBeGreaterThanOrEqual(55);
  });

  it.each([undefined, null, "", "not-an-email", "a@", 42, "x".repeat(250) + "@a.com"])(
    "rejects invalid input %#",
    async (rawEmail) => {
      const sendLink = vi.fn();
      const result = await requestMagicLink({ rawEmail, sendLink, minDurationMs: 0 });
      expect(result).toEqual({ status: "invalid", message: INVALID_EMAIL_MESSAGE });
      expect(sendLink).not.toHaveBeenCalled();
    },
  );
});
