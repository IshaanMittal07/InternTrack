"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { TAG_COLORS, TAG_COLOR_LABELS, type TagColor } from "@/lib/domain/constants";
import type { TagWithUsage } from "@/lib/domain/types";
import { deleteTagAction, updateTagAction } from "@/server/actions/tags";

import { TagPill } from "./tag-pill";

export function TagRow({ tag }: { tag: TagWithUsage }) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState<TagColor>(tag.color);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = name.trim() !== tag.name || color !== tag.color;
  const nameId = `tag-${tag.id}-name`;
  const colorId = `tag-${tag.id}-color`;

  function save(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateTagAction(tag.id, {
        ...(name.trim() !== tag.name ? { name } : {}),
        ...(color !== tag.color ? { color } : {}),
      });
      setMessage(
        result.ok
          ? { error: false, text: "Saved." }
          : { error: true, text: result.fieldErrors?.name ?? result.error },
      );
    });
  }

  const usage =
    tag.usage === 0
      ? "Not used yet"
      : `Used by ${tag.usage} ${tag.usage === 1 ? "opportunity" : "opportunities"}`;

  return (
    <li className="rounded-xl bg-surface p-4 shadow-card">
      <form onSubmit={save} className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto sm:min-w-40">
          <TagPill tag={{ name: name.trim() || tag.name, color }} />
          <p className="mt-1 text-xs text-ink-muted">{usage}</p>
        </div>
        <div className="min-w-40 flex-1 space-y-1.5">
          <label htmlFor={nameId} className="block text-sm font-medium">
            Name
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={message?.error ? true : undefined}
            className="input"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={colorId} className="block text-sm font-medium">
            Color
          </label>
          <select
            id={colorId}
            value={color}
            onChange={(e) => setColor(e.target.value as TagColor)}
            className="input"
          >
            {TAG_COLORS.map((c) => (
              <option key={c} value={c}>
                {TAG_COLOR_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1">
          <Button type="submit" size="sm" variant="secondary" pending={pending} disabled={!dirty}>
            Save<span className="sr-only"> tag {tag.name}</span>
          </Button>
          <ConfirmButton
            title={`Delete tag “${tag.name}”?`}
            message={
              tag.usage > 0
                ? `It will be removed from ${tag.usage} ${tag.usage === 1 ? "opportunity" : "opportunities"}. The opportunities themselves are kept.`
                : "This tag isn't used by any opportunity."
            }
            confirmLabel="Delete tag"
            onConfirm={() => deleteTagAction(tag.id)}
          >
            Delete<span className="sr-only"> tag {tag.name}</span>
          </ConfirmButton>
        </div>
      </form>
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 text-sm ${message?.error ? "text-danger" : "text-success"}`}
      >
        {message?.text}
      </p>
    </li>
  );
}
