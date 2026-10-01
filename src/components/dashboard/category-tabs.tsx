import Link from "next/link";

import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/domain/constants";
import { filtersToQuery, type Filters } from "@/lib/domain/filters";

export function CategoryTabs({
  filters,
  counts,
}: {
  filters: Filters;
  counts: Record<Category, number>;
}) {
  return (
    <nav aria-label="Categories" className="overflow-x-auto">
      <ul className="flex min-w-max gap-1 rounded-xl bg-surface-muted p-1">
        {CATEGORIES.map((c) => {
          const active = c === filters.tab;
          return (
            <li key={c}>
              <Link
                href={filtersToQuery({ ...filters, tab: c, stage: null })}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
                }`}
              >
                {CATEGORY_LABELS[c]}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    active ? "bg-accent text-on-accent" : "bg-surface text-ink-muted"
                  }`}
                >
                  {counts[c]}
                  <span className="sr-only"> opportunities</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
