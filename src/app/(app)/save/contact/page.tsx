import type { Metadata } from "next";
import Link from "next/link";

import { AddLinkedInContact, type PostingChoice } from "@/components/save/add-linkedin-contact";
import { buttonClasses } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import {
  canonicalLinkedInProfileUrl,
  parseLinkedInProfile,
  sameCompany,
} from "@/lib/domain/linkedin";

export const metadata: Metadata = { title: "Add LinkedIn contact" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Opened by the "Add LinkedIn contact" bookmark with what it read from a
 * profile. Adds the person as a contact on a posting that is already saved;
 * postings at their current company are suggested first.
 */
export default async function AddContactPage({ searchParams }: PageProps<"/save/contact">) {
  const { supabase, userId } = await requireUser();
  const params = await searchParams;
  const profile = parseLinkedInProfile({
    url: first(params.url),
    name: first(params.name),
    headline: first(params.headline),
    company: first(params.company),
    title: first(params.title),
    experience: first(params.experience),
  });

  if (!profile.linkedin_url) {
    return (
      <section className="mx-auto max-w-2xl rounded-xl bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold">Open a LinkedIn profile first</h1>
        <p className="mt-2 text-ink-muted">
          Click <strong>Add LinkedIn contact</strong> while you&apos;re on someone&apos;s profile
          page (a link starting with linkedin.com/in/).
        </p>
        <Link href="/save" className={`${buttonClasses("secondary")} mt-4`}>
          How the bookmarks work
        </Link>
      </section>
    );
  }

  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id, company, role_title, category, contacts!contacts_opportunity_id_fkey(linkedin_url)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load opportunities: ${error.message}`);

  const postings: PostingChoice[] = data
    .map(({ contacts, ...posting }) => ({
      ...posting,
      suggested: profile.company !== "" && sameCompany(posting.company, profile.company),
      alreadyAdded: contacts.some(
        (c) => canonicalLinkedInProfileUrl(c.linkedin_url ?? "") === profile.linkedin_url,
      ),
    }))
    // Stable sort keeps newest-first within each group.
    .sort((a, b) => Number(b.suggested) - Number(a.suggested));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AddLinkedInContact profile={profile} postings={postings} />
    </div>
  );
}
