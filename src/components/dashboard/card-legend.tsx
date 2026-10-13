import { HIGHLIGHT_BORDERS, HIGHLIGHT_LABELS } from "@/components/opportunities/highlight";
import { POSTING_HIGHLIGHTS } from "@/lib/domain/summary";

/** Explains the colored card outlines. */
export function CardLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
      <span className="font-medium">Card outlines:</span>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Card outline colors">
        {POSTING_HIGHLIGHTS.map((h) => (
          <li key={h} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`inline-block size-3 rounded-sm border-2 bg-surface ${HIGHLIGHT_BORDERS[h]}`}
            />
            {HIGHLIGHT_LABELS[h]}
          </li>
        ))}
      </ul>
    </div>
  );
}
