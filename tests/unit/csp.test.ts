import { describe, expect, it } from "vitest";

import { buildCsp, generateNonce } from "@/lib/security/csp";

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(";").map((part) => {
      const [name = "", ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

describe("generateNonce", () => {
  it("produces a base64 value with 128 bits of randomness", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });

  it("is different on every call", () => {
    const nonces = new Set(Array.from({ length: 100 }, generateNonce));
    expect(nonces.size).toBe(100);
  });
});

describe("buildCsp", () => {
  const prod = directives(buildCsp({ nonce: "abc123", isDev: false }));
  const dev = directives(buildCsp({ nonce: "abc123", isDev: true }));

  it("only allows scripts carrying the request nonce", () => {
    expect(prod.get("script-src")).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
  });

  it("never allows unsafe-inline or unsafe-eval in production", () => {
    const all = [...prod.values()].flat();
    expect(all).not.toContain("'unsafe-inline'");
    expect(all).not.toContain("'unsafe-eval'");
  });

  it("allows unsafe-eval only in development", () => {
    expect(dev.get("script-src")).toContain("'unsafe-eval'");
  });

  it("locks styles to the nonce in production, relaxing only in development", () => {
    expect(prod.get("style-src")).toEqual(["'self'", "'nonce-abc123'"]);
    expect(dev.get("style-src")).toEqual(["'self'", "'unsafe-inline'"]);
    // Scripts stay nonce-locked even in development.
    expect(dev.get("script-src")).toContain("'nonce-abc123'");
    expect(dev.get("script-src")).not.toContain("'unsafe-inline'");
  });

  it("forbids framing, plugins, and foreign form targets", () => {
    expect(prod.get("frame-ancestors")).toEqual(["'none'"]);
    expect(prod.get("object-src")).toEqual(["'none'"]);
    expect(prod.get("form-action")).toEqual(["'self'"]);
    expect(prod.get("base-uri")).toEqual(["'self'"]);
  });

  it("only lets the browser connect back to this site", () => {
    expect(prod.get("connect-src")).toEqual(["'self'"]);
  });

  it("upgrades insecure requests in production but not in development", () => {
    expect(prod.has("upgrade-insecure-requests")).toBe(true);
    expect(dev.has("upgrade-insecure-requests")).toBe(false);
  });
});
