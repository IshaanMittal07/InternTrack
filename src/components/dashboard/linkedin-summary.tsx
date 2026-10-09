import Link from "next/link";

import { filtersToQuery, type Filters } from "@/lib/domain/filters";
import { activeLinkedinConnection } from "@/lib/domain/summary";
import type { OpportunityWithRelations } from "@/lib/domain/types";

/**
 * LinkedIn connection requests across the contacts in the current tab.
 * Contacts who have been messaged no longer count; see activeLinkedinConnection.
 */
export function LinkedinSummary({
  opportunities,
  filters,
}: {
  opportunities: OpportunityWithRelations[];
  filters: Filters;
}) {
  const contacts = opportunities
    .filter((o) => o.category === filters.tab)
    .flatMap((o) => o.contacts);
  const sent = contacts.filter((c) => activeLinkedinConnection(c) === "sent").length;
  const unsent = contacts.filter((c) => activeLinkedinConnection(c) === "not_sent").length;

  const stats = [
    { status: "sent", label: "Connections sent", value: sent },
    { status: "not_sent", label: "Connections unsent", value: unsent },
  ] as const;

  return (
    <section
      aria-labelledby="linkedin-heading"
      className="space-y-3 rounded-xl bg-surface p-4 shadow-card"
    >
      <h2 id="linkedin-heading" className="text-lg font-semibold">
        LinkedIn
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:max-w-md">
        {stats.map((s) => {
          const active = filters.linkedin === s.status;
          return (
            <li key={s.status}>
              <Link
                href={filtersToQuery({ ...filters, linkedin: active ? null : s.status })}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={`block rounded-lg p-3 ring-1 transition-colors ${
                  active
                    ? "bg-accent-soft ring-accent"
                    : "bg-surface-muted ring-transparent hover:ring-line-strong"
                }`}
              >
                <span className="block text-xs font-medium text-ink-muted">{s.label}</span>
                <span className="mt-1 block font-serif text-2xl font-semibold">{s.value}</span>
                <span className="sr-only">
                  {active ? ". Showing only these. Select to clear." : ". Show only these."}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
