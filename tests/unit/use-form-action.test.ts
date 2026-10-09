import { describe, expect, it } from "vitest";

import {
  OFFLINE_ERROR,
  OUTDATED_ERROR,
  UNEXPECTED_ERROR,
  describeActionError,
} from "@/components/ui/use-form-action";

describe("describeActionError", () => {
  it("asks for a refresh when the page is from an older deployment", () => {
    for (const message of [
      'Server Action "abc123" was not found on the server.',
      "Failed to find Server Action. This request might be from an older or newer deployment.",
    ]) {
      expect(describeActionError(new Error(message), true)).toBe(OUTDATED_ERROR);
    }
  });

  it("reports a lost connection only when offline", () => {
    expect(describeActionError(new TypeError("Failed to fetch"), false)).toBe(OFFLINE_ERROR);
  });

  it("falls back to a generic message", () => {
    expect(describeActionError(new TypeError("Failed to fetch"), true)).toBe(UNEXPECTED_ERROR);
    expect(describeActionError("boom", true)).toBe(UNEXPECTED_ERROR);
  });
});
