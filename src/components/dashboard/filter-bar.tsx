"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";

import {
  PRIORITIES,
  PRIORITY_LABELS,
  REFERRAL_LABELS,
  REFERRAL_STATUSES,
  STAGES,
  STAGE_LABELS,
} from "@/lib/domain/constants";
import {
  DEFAULT_FILTERS,
  SORT_KEYS,
  SORT_LABELS,
  filtersToQuery,
  hasActiveFilters,
  type Filters,
} from "@/lib/domain/filters";
import type { Tag } from "@/lib/domain/types";

/** Search, filters and sort. All state lives in the URL. */
export function FilterBar({ filters: current, tags }: { filters: Filters; tags: Tag[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Show the new selection immediately while the page reloads with it.
  const [filters, setOptimistic] = useOptimistic(current);
  const [q, setQ] = useState(current.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagMenu = useRef<HTMLDetailsElement>(null);

  // Close the tag menu on Escape or a click outside it.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const menu = tagMenu.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    }
    function onKeyDown(event: KeyboardEvent) {
      const menu = tagMenu.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function update(next: Partial<Filters>) {
    const merged = { ...filters, q, ...next };
    startTransition(() => {
      setOptimistic(merged);
      router.replace(filtersToQuery(merged), { scroll: false });
    });
  }

  function onSearch(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ q: value.trim() }), 300);
  }

  function toggleTag(id: string) {
    const set = new Set(filters.tags);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    update({ tags: [...set] });
  }

  const selectedTagNames = tags.filter((t) => filters.tags.includes(t.id)).map((t) => t.name);

  return (
    <div className="space-y-3 rounded-xl bg-surface p-4 shadow-card">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <div className="col-span-2 space-y-1.5">
          <label htmlFor="filter-q" className="block text-sm font-medium">
            Search
          </label>
          <input
            id="filter-q"
            type="search"
            value={q}
            maxLength={100}
            placeholder="Company or role"
            onChange={(e) => onSearch(e.target.value)}
            className="input"
          />
        </div>

        {filters.tab === "applied" && (
          <Select
            id="filter-stage"
            label="Stage"
            value={filters.stage ?? ""}
            onChange={(v) => update({ stage: (v || null) as Filters["stage"] })}
            options={STAGES.map((s) => [s, STAGE_LABELS[s]])}
          />
        )}
        <Select
          id="filter-referral"
          label="Referral"
          value={filters.referral ?? ""}
          onChange={(v) => update({ referral: (v || null) as Filters["referral"] })}
          options={REFERRAL_STATUSES.map((s) => [s, REFERRAL_LABELS[s]])}
        />
        <Select
          id="filter-priority"
          label="Priority"
          value={filters.priority ?? ""}
          onChange={(v) => update({ priority: (v || null) as Filters["priority"] })}
          options={PRIORITIES.map((p) => [p, PRIORITY_LABELS[p].replace(" priority", "")])}
        />
        <Select
          id="filter-sort"
          label="Sort by"
          value={filters.sort}
          onChange={(v) => update({ sort: v as Filters["sort"] })}
          options={SORT_KEYS.map((k) => [k, SORT_LABELS[k]])}
          allowEmpty={false}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <details ref={tagMenu} className="group relative">
          <summary className="cursor-pointer list-none rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-line-strong hover:bg-surface-muted">
            Tags{filters.tags.length ? ` (${filters.tags.length})` : ""}
            <span aria-hidden="true" className="ml-1 inline-block group-open:rotate-180">
              ▾
            </span>
          </summary>
          <fieldset className="absolute z-10 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl bg-surface p-3 shadow-raised">
            <legend className="sr-only">Show opportunities with any of these tags</legend>
            {tags.length === 0 && <p className="text-sm text-ink-muted">No tags yet.</p>}
            {tags.map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={filters.tags.includes(t.id)}
                  onChange={() => toggleTag(t.id)}
                  className="size-4 accent-accent"
                />
                {t.name}
              </label>
            ))}
          </fieldset>
        </details>
        {selectedTagNames.length > 0 && (
          <span className="text-sm text-ink-muted">Any of: {selectedTagNames.join(", ")}</span>
        )}
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              startTransition(() =>
                router.replace(
                  filtersToQuery({ ...DEFAULT_FILTERS, tab: filters.tab, sort: filters.sort }),
                  { scroll: false },
                ),
              );
            }}
            className="ml-auto text-sm font-medium text-accent-text underline underline-offset-4"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
  allowEmpty = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  allowEmpty?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input">
        {allowEmpty && <option value="">Any</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
