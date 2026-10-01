import { describe, expect, it } from "vitest";

import { moveNeedsConfirmation, planCategoryMove } from "@/lib/domain/category-move";

const today = "2026-10-01";

describe("planCategoryMove", () => {
  it("Planning → Applied sets the date (default today) and stage", () => {
    expect(planCategoryMove("planning", "applied", { today })).toEqual({
      category: "applied",
      date_applied: today,
      application_stage: "submitted",
    });
    expect(planCategoryMove("interested", "applied", { today, dateApplied: "2026-09-28" })).toEqual(
      {
        category: "applied",
        date_applied: "2026-09-28",
        application_stage: "submitted",
      },
    );
  });

  it("Applied → Planning clears date applied and stage", () => {
    expect(planCategoryMove("applied", "planning", { today })).toEqual({
      category: "planning",
      date_applied: null,
      application_stage: null,
    });
  });

  it("Planning ↔ Interested only changes the category", () => {
    expect(planCategoryMove("planning", "interested", { today })).toEqual({
      category: "interested",
    });
  });

  it("is a no-op for the same category", () => {
    expect(planCategoryMove("applied", "applied", { today })).toBeNull();
  });

  it("asks for confirmation only when leaving Applied", () => {
    expect(moveNeedsConfirmation("applied", "planning")).toBe(true);
    expect(moveNeedsConfirmation("applied", "interested")).toBe(true);
    expect(moveNeedsConfirmation("planning", "applied")).toBe(false);
    expect(moveNeedsConfirmation("planning", "interested")).toBe(false);
  });
});
