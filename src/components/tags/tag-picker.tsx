"use client";

import { useId, useOptimistic, useState, useTransition } from "react";

import { Pill } from "@/components/ui/pill";
import type { Tag } from "@/lib/domain/types";
import { tagNameSchema } from "@/lib/validation/tag";
import { assignTagAction, assignTagByNameAction, unassignTagAction } from "@/server/actions/tags";

type Change = { type: "add"; id: string } | { type: "remove"; id: string };

/**
 * Searchable multi-select for an opportunity's tags. Typing a name that
 * doesn't exist yet offers to create it on the spot.
 */
export function TagPicker({
  opportunityId,
  allTags,
  selectedIds,
}: {
  opportunityId: string;
  allTags: Tag[];
  selectedIds: string[];
}) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, applyChange] = useOptimistic(selectedIds, (ids: string[], change: Change) =>
    change.type === "add" ? [...ids, change.id] : ids.filter((id) => id !== change.id),
  );

  const selectedSet = new Set(selected);
  const selectedTags = allTags.filter((t) => selectedSet.has(t.id));
  const trimmed = query.trim().replace(/\s+/g, " ");
  const lower = trimmed.toLowerCase();
  const available = allTags.filter(
    (t) => !selectedSet.has(t.id) && (!lower || t.name.toLowerCase().includes(lower)),
  );
  const exact = allTags.find((t) => t.name.toLowerCase() === lower);
  const canCreate = trimmed.length > 0 && !exact && tagNameSchema.safeParse(trimmed).success;

  function run(change: Change | null, action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      if (change) applyChange(change);
      const result = await action();
      if (!result.ok) setError(result.error ?? "Couldn't update tags.");
    });
  }

  const add = (tag: Tag) => {
    setQuery("");
    run({ type: "add", id: tag.id }, () => assignTagAction(opportunityId, tag.id));
  };
  const remove = (tag: Tag) =>
    run({ type: "remove", id: tag.id }, () => unassignTagAction(opportunityId, tag.id));
  const create = () => {
    const name = trimmed;
    setQuery("");
    run(null, () => assignTagByNameAction(opportunityId, name));
  };

  function onEnter() {
    if (exact && !selectedSet.has(exact.id)) add(exact);
    else if (canCreate) create();
    else if (available.length === 1) add(available[0]!);
  }

  return (
    <div className="space-y-3">
      {selectedTags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags on this opportunity">
          {selectedTags.map((tag) => (
            <li key={tag.id}>
              <Pill tone={tag.color} className="pr-1">
                <span aria-hidden="true">#</span>
                {tag.name}
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  className="ml-0.5 rounded-full px-1.5 leading-5 hover:bg-surface/60"
                  aria-label={`Remove tag ${tag.name}`}
                >
                  ×
                </button>
              </Pill>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No tags yet.</p>
      )}

      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium">
          Add a tag
        </label>
        <input
          id={inputId}
          type="text"
          value={query}
          maxLength={30}
          autoComplete="off"
          placeholder="Search or type a new tag"
          aria-describedby={listId}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
          className="input"
        />
      </div>

      <div id={listId} aria-live="polite" className="flex flex-wrap gap-1.5">
        {available.slice(0, 12).map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => add(tag)}
            disabled={pending}
            className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-line hover:ring-line-strong"
          >
            <span aria-hidden="true">+ </span>
            <span className="sr-only">Add tag </span>
            {tag.name}
          </button>
        ))}
        {canCreate && (
          <button
            type="button"
            onClick={create}
            disabled={pending}
            className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-text ring-1 ring-accent hover:bg-surface"
          >
            Create tag “{trimmed}”
          </button>
        )}
        {lower && available.length === 0 && !canCreate && (
          <p className="text-sm text-ink-muted">
            {exact ? `“${exact.name}” is already added.` : "Tag names can be up to 30 characters."}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
