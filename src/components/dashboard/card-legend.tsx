import Link from "next/link";

import { HIGHLIGHT_BORDERS, HIGHLIGHT_LABELS } from "@/components/opportunities/highlight";
import { filtersToQuery, type Filters } from "@/lib/domain/filters";
import { POSTING_HIGHLIGHTS, type PostingHighlight } from "@/lib/domain/summary";

/**
 * Explains the colored card outlines. Each color is also a filter: clicking
 * it shows only the postings with that outline, and clicking it again clears it.
 */
export function CardLegend({
  filters,
  counts,
}: {
  filters: Filters;
  counts: Record<PostingHighlight, number>;
}) {
  return (
    <nav
      aria-label="Filter by card color"
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-muted"
    >
      <span className="mr-1 font-medium">Card colors:</span>
      {POSTING_HIGHLIGHTS.map((h) => {
        const active = filters.color === h;
        return (
          <Link
            key={h}
            href={filtersToQuery({ ...filters, color: active ? null : h })}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-surface-muted hover:text-ink ${
              active ? "bg-surface text-ink shadow-card ring-1 ring-line-strong" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block size-3 rounded-sm border-2 bg-surface ${HIGHLIGHT_BORDERS[h]}`}
            />
            {HIGHLIGHT_LABELS[h]}
            <span className="tabular-nums">({counts[h]})</span>
          </Link>
        );
      })}
      {filters.color && (
        <Link
          href={filtersToQuery({ ...filters, color: null })}
          scroll={false}
          className="ml-1 font-medium text-accent-text underline underline-offset-4"
        >
          Show all
        </Link>
      )}
    </nav>
  );
}
