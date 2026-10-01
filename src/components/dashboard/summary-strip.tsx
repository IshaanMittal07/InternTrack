import Link from "next/link";

import { TagPill } from "@/components/tags/tag-pill";
import { filtersToQuery, type Filters } from "@/lib/domain/filters";
import type { Summary } from "@/lib/domain/summary";

export function SummaryStrip({ summary, filters }: { summary: Summary; filters: Filters }) {
  const stats: { label: string; value: number; tone?: "warning" | "danger" }[] = [
    { label: "Applied", value: summary.totalApplied },
    { label: "Interviews in progress", value: summary.interviewsInProgress },
    { label: "Referrals received", value: summary.referralsReceived },
    {
      label: "Follow-ups due this week",
      value: summary.followUpsDueThisWeek,
      ...(summary.followUpsDueThisWeek > 0 ? { tone: "danger" as const } : {}),
    },
    {
      label: "Deadlines in next 14 days",
      value: summary.upcomingDeadlines,
      ...(summary.upcomingDeadlines > 0 ? { tone: "warning" as const } : {}),
    },
  ];

  return (
    <section aria-label="Summary" className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl p-4 shadow-card ${
              s.tone === "danger"
                ? "bg-danger-soft"
                : s.tone === "warning"
                  ? "bg-warning-soft"
                  : "bg-surface"
            }`}
          >
            <dt
              className={`text-xs font-medium ${
                s.tone === "danger"
                  ? "text-danger"
                  : s.tone === "warning"
                    ? "text-warning"
                    : "text-ink-muted"
              }`}
            >
              {s.label}
            </dt>
            <dd className="mt-1 font-serif text-3xl font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
      {summary.tagCounts.length > 0 && (
        <ul aria-label="Opportunities per tag" className="flex flex-wrap gap-1.5">
          {summary.tagCounts.map((t) => (
            <li key={t.id}>
              <Link
                href={filtersToQuery({ ...filters, tags: [t.id] })}
                scroll={false}
                className="rounded-full"
                aria-label={`${t.name}: ${t.count}. Show only this tag`}
              >
                <TagPill tag={t} suffix={`: ${t.count}`} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
