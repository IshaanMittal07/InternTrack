import type { Metadata } from "next";

import { NewTagForm } from "@/components/tags/new-tag-form";
import { TagRow } from "@/components/tags/tag-row";
import { requireUser } from "@/lib/auth/session";
import { listTags } from "@/server/services/queries";

export const metadata: Metadata = { title: "Manage tags" };

export default async function TagsPage() {
  const { supabase, userId } = await requireUser();
  const tags = await listTags(supabase, userId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">Manage tags</h1>
        <p className="mt-1 text-ink-muted">
          Rename, recolor or delete your job-type tags. Deleting a tag removes it from opportunities
          but never deletes the opportunities themselves.
        </p>
      </div>

      <section aria-labelledby="new-tag-heading" className="rounded-xl bg-surface p-5 shadow-card">
        <h2 id="new-tag-heading" className="mb-3 text-lg font-semibold">
          New tag
        </h2>
        <NewTagForm />
      </section>

      <section aria-labelledby="your-tags-heading" className="space-y-3">
        <h2 id="your-tags-heading" className="text-lg font-semibold">
          Your tags ({tags.length})
        </h2>
        {tags.length === 0 ? (
          <p className="rounded-xl bg-surface p-6 text-ink-muted shadow-card">
            No tags yet. Create one above, or add tags directly from an opportunity.
          </p>
        ) : (
          <ul className="space-y-2">
            {tags.map((tag) => (
              <TagRow key={`${tag.id}-${tag.name}-${tag.color}`} tag={tag} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
