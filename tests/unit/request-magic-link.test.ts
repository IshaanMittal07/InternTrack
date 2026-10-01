import { describe, expect, it, vi } from "vitest";

import {
  INVALID_EMAIL_MESSAGE,
  NEUTRAL_MESSAGE,
  requestMagicLink,
} from "@/server/auth/request-magic-link";

const allowedEmail = "me@example.com";

describe("requestMagicLink", () => {
  it("sends a link to the allowed email (normalized)", async () => {
    const sendLink = vi.fn().mockResolvedValue({ error: null });
    const result = await requestMagicLink({
      rawEmail: "  ME@example.com ",
      allowedEmail,
      sendLink,
      minDurationMs: 0,
    });
    expect(sendLink).toHaveBeenCalledWith("me@example.com");
    expect(result).toEqual({ status: "sent", message: NEUTRAL_MESSAGE });
  });

  it("does NOT send for any other email, but answers with the same message", async () => {
    const sendLink = vi.fn().mockResolvedValue({ error: null });
    const result = await requestMagicLink({
      rawEmail: "intruder@example.com",
      allowedEmail,
      sendLink,
      minDurationMs: 0,
    });
    expect(sendLink).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "sent", message: NEUTRAL_MESSAGE });
  });

  it("gives the same answer even when sending fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sendLink = vi.fn().mockResolvedValue({ error: new Error("rate limited") });
    const result = await requestMagicLink({
      rawEmail: allowedEmail,
      allowedEmail,
      sendLink,
      minDurationMs: 0,
    });
    expect(result).toEqual({ status: "sent", message: NEUTRAL_MESSAGE });
    spy.mockRestore();
  });

  it("takes at least the minimum duration either way", async () => {
    for (const rawEmail of [allowedEmail, "other@example.com"]) {
      const start = performance.now();
      await requestMagicLink({
        rawEmail,
        allowedEmail,
        sendLink: async () => ({ error: null }),
        minDurationMs: 60,
      });
      expect(performance.now() - start).toBeGreaterThanOrEqual(55);
    }
  });

  it.each([undefined, null, "", "not-an-email", "a@", 42, "x".repeat(250) + "@a.com"])(
    "rejects invalid input %#",
    async (rawEmail) => {
      const sendLink = vi.fn();
      const result = await requestMagicLink({ rawEmail, allowedEmail, sendLink, minDurationMs: 0 });
      expect(result).toEqual({ status: "invalid", message: INVALID_EMAIL_MESSAGE });
      expect(sendLink).not.toHaveBeenCalled();
    },
  );
});
