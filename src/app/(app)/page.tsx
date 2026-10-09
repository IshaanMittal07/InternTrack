import Link from "next/link";

import { CategoryTabs } from "@/components/dashboard/category-tabs";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { JobBoards } from "@/components/dashboard/job-boards";
import { SummaryStrip } from "@/components/dashboard/summary-strip";
import { NewOpportunityButton } from "@/components/opportunities/new-opportunity-button";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { OpportunityDrawer } from "@/components/opportunities/opportunity-drawer";
import { requireUser } from "@/lib/auth/session";
import { CATEGORY_DESCRIPTIONS, type Category } from "@/lib/domain/constants";
import { todayIn } from "@/lib/domain/dates";
import {
  applyFilters,
  countByCategory,
  filtersToQuery,
  hasActiveFilters,
  parseFilters,
  type Filters,
} from "@/lib/domain/filters";
import { computeSummary } from "@/lib/domain/summary";
import { env } from "@/lib/env";
import { listJobBoards } from "@/server/services/job-boards";
import { listOpportunities, listTags } from "@/server/services/queries";

const EMPTY: Record<Category, { title: string; body: string; cta: string }> = {
  applied: {
    title: "No applications yet",
    body: "When you submit an application, add it here, or move something over from Planning.",
    cta: "Add an application",
  },
  planning: {
    title: "Nothing planned yet",
    body: "Save postings you intend to apply to, with their deadlines, so nothing slips by.",
    cta: "Add a posting",
  },
  interested: {
    title: "No companies saved yet",
    body: "Keep a list of companies you like that haven't opened internships, and start networking early.",
    cta: "Add a company",
  },
};

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const { supabase, userId } = await requireUser();
  const params = await searchParams;
  const filters = parseFilters(params);
  const today = todayIn(env().APP_TIMEZONE);

  const [opportunities, tags, jobBoards] = await Promise.all([
    listOpportunities(supabase, userId),
    listTags(supabase, userId),
    listJobBoards(supabase, userId),
  ]);

  const tagsById = new Map(tags.map((t) => [t.id, t]));
  const summary = computeSummary(opportunities, tags, today);
  const counts = countByCategory(opportunities);
  const visible = applyFilters(opportunities, filters);
  const openId = typeof params.open === "string" ? params.open : undefined;
  const open = openId ? opportunities.find((o) => o.id === openId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Your internship search</h1>
          <p className="mt-1 text-ink-muted">{CATEGORY_DESCRIPTIONS[filters.tab]}</p>
        </div>
        <NewOpportunityButton key={filters.tab} defaultCategory={filters.tab} today={today} />
      </div>

      <SummaryStrip summary={summary} filters={filters} />
      <JobBoards boards={jobBoards} />
      <CategoryTabs filters={filters} counts={counts} />
      <FilterBar key={filters.tab} filters={filters} tags={tags} />

      <section aria-label="Opportunities" aria-live="polite">
        {visible.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((o) => (
              <OpportunityCard
                key={o.id}
                opportunity={o}
                tagsById={tagsById}
                today={today}
                href={filtersToQuery(filters, { open: o.id })}
              />
            ))}
          </ul>
        ) : (
          <EmptyState filters={filters} total={counts[filters.tab]} today={today} />
        )}
      </section>

      {open && (
        <OpportunityDrawer
          key={open.id}
          opportunity={open}
          tags={tags}
          today={today}
          closeHref={filtersToQuery(filters)}
        />
      )}
    </div>
  );
}

function EmptyState({ filters, total, today }: { filters: Filters; total: number; today: string }) {
  if (total > 0 && hasActiveFilters(filters)) {
    return (
      <div className="rounded-xl bg-surface p-8 text-center shadow-card">
        <h2 className="text-xl font-semibold">No matches</h2>
        <p className="mt-2 text-ink-muted">Nothing here matches these filters.</p>
        <Link
          href={filtersToQuery({
            ...filters,
            q: "",
            stage: null,
            referral: null,
            priority: null,
            tags: [],
          })}
          scroll={false}
          className="mt-4 inline-block font-medium text-accent-text underline underline-offset-4"
        >
          Clear filters
        </Link>
      </div>
    );
  }

  const copy = EMPTY[filters.tab];
  return (
    <div className="rounded-xl bg-surface p-8 text-center shadow-card">
      <h2 className="text-xl font-semibold">{copy.title}</h2>
      <p className="mx-auto mt-2 max-w-md text-ink-muted">{copy.body}</p>
      <div className="mt-5">
        <NewOpportunityButton
          defaultCategory={filters.tab}
          today={today}
          label={copy.cta}
          variant="secondary"
        />
      </div>
    </div>
  );
}
