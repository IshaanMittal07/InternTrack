import type { Metadata } from "next";

import { BookmarkletSetup } from "@/components/save/bookmarklet-setup";
import { QuickSave } from "@/components/save/quick-save";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Save to tracker" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * With `?url=`, saves that job page as applied (the bookmark opens this).
 * Without it, explains how to add the bookmark.
 */
export default async function SavePage({ searchParams }: PageProps<"/save">) {
  await requireUser();
  const params = await searchParams;
  const url = first(params.url);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {url ? (
        <QuickSave
          input={{
            url,
            company: first(params.company),
            role: first(params.role),
            title: first(params.title),
          }}
        />
      ) : (
        <BookmarkletSetup />
      )}
    </div>
  );
}
