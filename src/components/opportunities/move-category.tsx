"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { moveNeedsConfirmation } from "@/lib/domain/category-move";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/domain/constants";
import type { Opportunity } from "@/lib/domain/types";
import { moveOpportunityAction } from "@/server/actions/opportunities";

/**
 * Moving to Applied asks for the date applied (default today) and sets the
 * stage to Submitted. Moving out of Applied asks for confirmation because it
 * clears the date applied and stage.
 */
export function MoveCategory({ opportunity, today }: { opportunity: Opportunity; today: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<Category | null>(null);
  const [dateApplied, setDateApplied] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function move(to: Category, date?: string) {
    setError(null);
    startTransition(async () => {
      const result = await moveOpportunityAction({
        id: opportunity.id,
        to,
        ...(date ? { date_applied: date } : {}),
      });
      if (!result.ok) {
        setError(result.fieldErrors?.date_applied ?? result.error);
        return;
      }
      setTarget(null);
      router.push(`/?tab=${to}&open=${opportunity.id}`, { scroll: false });
    });
  }

  function choose(to: Category) {
    if (to === "applied" || moveNeedsConfirmation(opportunity.category, to)) {
      setDateApplied(today);
      setError(null);
      setTarget(to);
    } else {
      move(to);
    }
  }

  const others = CATEGORIES.filter((c) => c !== opportunity.category);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {others.map((c) => (
          <Button
            key={c}
            variant="secondary"
            size="sm"
            onClick={() => choose(c)}
            pending={pending && !target}
          >
            Move to {CATEGORY_LABELS[c]}
          </Button>
        ))}
      </div>
      {error && !target && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target ? `Move to ${CATEGORY_LABELS[target]}?` : ""}
      >
        {target === "applied" ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              move("applied", dateApplied);
            }}
          >
            <p className="text-ink-muted">The stage will be set to Submitted.</p>
            <div className="space-y-1.5">
              <label htmlFor="move-date-applied" className="block text-sm font-medium">
                Date applied
              </label>
              <input
                id="move-date-applied"
                type="date"
                required
                value={dateApplied}
                max="9999-12-31"
                onChange={(e) => setDateApplied(e.target.value)}
                className="input"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTarget(null)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" pending={pending}>
                {pending ? "Moving…" : "Move to Applied"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-ink-muted">
              The date applied and application stage will be cleared. This can&apos;t be undone.
            </p>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTarget(null)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={() => target && move(target)} pending={pending}>
                {pending ? "Moving…" : target ? `Move to ${CATEGORY_LABELS[target]}` : "Move"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
