import type { Category, Stage } from "./constants";

export type CategoryPatch = {
  category: Category;
  date_applied?: string | null;
  application_stage?: Stage | null;
};

/**
 * What changes when an opportunity moves between categories:
 * - into Applied: date applied (default today) and stage "submitted"
 * - out of Applied: date applied and stage are cleared
 * - between Planning and Interested: only the category changes
 * Returns null when nothing would change.
 */
export function planCategoryMove(
  from: Category,
  to: Category,
  { dateApplied, today }: { dateApplied?: string | null; today: string },
): CategoryPatch | null {
  if (from === to) return null;
  if (to === "applied") {
    return { category: to, date_applied: dateApplied || today, application_stage: "submitted" };
  }
  if (from === "applied") {
    return { category: to, date_applied: null, application_stage: null };
  }
  return { category: to };
}

/** Moving out of Applied loses data, so the UI asks first. */
export function moveNeedsConfirmation(from: Category, to: Category): boolean {
  return from === "applied" && to !== "applied";
}
