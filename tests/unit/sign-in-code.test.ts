import { describe, expect, it, vi } from "vitest";

import { BAD_CODE_MESSAGE, verifySignInCode } from "@/server/auth/sign-in-code";

describe("verifySignInCode", () => {
  it("checks the code for the normalized email, ignoring spaces", async () => {
    const verify = vi.fn().mockResolvedValue({ error: null });
    const result = await verifySignInCode({
      rawEmail: " Me@Example.com ",
      rawCode: "123 456",
      verify,
    });
    expect(verify).toHaveBeenCalledWith("me@example.com", "123456");
    expect(result).toEqual({ ok: true });
  });

  it("rejects a code the server refuses", async () => {
    const verify = vi.fn().mockResolvedValue({ error: new Error("expired") });
    const result = await verifySignInCode({
      rawEmail: "me@example.com",
      rawCode: "123456",
      verify,
    });
    expect(result).toEqual({ ok: false, message: BAD_CODE_MESSAGE });
  });

  it("never asks the server about malformed input", async () => {
    const verify = vi.fn();
    for (const [rawEmail, rawCode] of [
      ["me@example.com", "12345"],
      ["me@example.com", "abcdef"],
      ["me@example.com", null],
      ["not an email", "123456"],
    ]) {
      const result = await verifySignInCode({ rawEmail, rawCode, verify });
      expect(result).toEqual({ ok: false, message: BAD_CODE_MESSAGE });
    }
    expect(verify).not.toHaveBeenCalled();
  });
});
