import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Checks WCAG AA contrast for every text/background token pair, in both the
 * light and the dark theme defined in src/app/globals.css.
 */

const css = readFileSync(path.resolve(__dirname, "../../src/app/globals.css"), "utf8");

function readTokens(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    tokens[match[1]!] = match[2]!.toLowerCase();
  }
  return tokens;
}

const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const themeStart = css.indexOf("@theme inline {");
const light = readTokens(css.slice(0, darkStart));
const dark = readTokens(css.slice(darkStart, themeStart));

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT = 4.5; // WCAG AA, normal text
const UI = 3; // WCAG AA, non-text UI (borders, focus rings)

const tagColors = ["terracotta", "sage", "amber", "slate", "plum", "teal"];

const pairs: [fg: string, bg: string, min: number][] = [
  ["ink", "canvas", TEXT],
  ["ink", "surface", TEXT],
  ["ink", "surface-muted", TEXT],
  ["ink-muted", "canvas", TEXT],
  ["ink-muted", "surface", TEXT],
  ["ink-muted", "surface-muted", TEXT],
  ["on-accent", "accent", TEXT],
  ["on-accent", "accent-hover", TEXT],
  ["accent-text", "accent-soft", TEXT],
  ["accent-text", "surface", TEXT],
  ["accent-text", "canvas", TEXT],
  ["success", "success-soft", TEXT],
  ["success", "surface", TEXT],
  ["warning", "warning-soft", TEXT],
  ["warning", "surface", TEXT],
  ["danger", "danger-soft", TEXT],
  ["danger", "surface", TEXT],
  ["line-strong", "surface", UI],
  ["line-strong", "canvas", UI],
  ["focus", "surface", UI],
  ["focus", "canvas", UI],
  ["accent", "surface", UI],
  ...tagColors.map((c): [string, string, number] => [`tag-${c}-fg`, `tag-${c}-bg`, TEXT]),
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast", (_theme, tokens) => {
  it.each(pairs)("%s on %s meets %d:1", (fg, bg, min) => {
    expect(tokens[fg], `missing token --${fg}`).toBeDefined();
    expect(tokens[bg], `missing token --${bg}`).toBeDefined();
    expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(min);
  });
});

it("light theme uses the requested base colors", () => {
  expect(light.canvas).toBe("#faf7f2");
  expect(light.ink).toBe("#2d2a26");
  expect(light.accent).toBe("#c2410c");
});
