"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { useFormAction } from "@/components/ui/use-form-action";
import { fail } from "@/lib/action-result";
import { CATEGORY_LABELS, type Category } from "@/lib/domain/constants";
import { roleAt, type ProfileDetails } from "@/lib/domain/linkedin";
import { createContactAction } from "@/server/actions/contacts";

export type PostingChoice = {
  id: string;
  company: string;
  role_title: string | null;
  category: Category;
  /** At the person's current company. */
  suggested: boolean;
  /** This profile is already one of the posting's contacts. */
  alreadyAdded: boolean;
};

function postingLabel(p: PostingChoice): string {
  const role = p.role_title ? ` — ${p.role_title}` : "";
  const added = p.alreadyAdded ? " (already added)" : "";
  return `${p.company}${role} · ${CATEGORY_LABELS[p.category]}${added}`;
}

/** Review what was read from the profile, pick a saved posting, and add the contact. */
export function AddLinkedInContact({
  profile,
  postings,
}: {
  profile: ProfileDetails;
  postings: PostingChoice[];
}) {
  const [saved, setSaved] = useState<PostingChoice | null>(null);
  const suggested = postings.filter((p) => p.suggested);
  const others = postings.filter((p) => !p.suggested);
  const defaultPosting = suggested.find((p) => !p.alreadyAdded);
  /** Their role at the posting's company per their Experience, else their current role. */
  const titleFor = (posting: PostingChoice | undefined) =>
    (posting && roleAt(profile.experience, posting.company)) || profile.title;
  const [title, setTitle] = useState(() => titleFor(defaultPosting));
  // Once the title is typed in, picking another posting no longer replaces it.
  const [titleEdited, setTitleEdited] = useState(false);
  const form = useFormAction<{ id: string }>(
    (formData) => {
      const opportunityId = String(formData.get("opportunity_id") ?? "");
      if (!opportunityId) {
        return Promise.resolve(
          fail("Choose the posting to add this contact to.", {
            opportunity_id: "Choose a posting",
          }),
        );
      }
      return createContactAction(opportunityId, null, formData);
    },
    (_data, el) => {
      const id = new FormData(el).get("opportunity_id");
      setSaved(postings.find((p) => p.id === id) ?? null);
    },
  );
  const errors = form.fieldErrors;

  if (saved) {
    return (
      <section className="rounded-xl bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold">Contact added</h1>
        <p className="mt-3 text-lg font-medium break-words">
          {profile.name || "This person"} → {saved.company}
          {saved.role_title ? ` — ${saved.role_title}` : ""}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/?tab=${saved.category}&open=${saved.id}`}
            className={buttonClasses("primary")}
          >
            Open in tracker
          </Link>
          <Button variant="secondary" onClick={() => window.close()}>
            Close tab
          </Button>
        </div>
      </section>
    );
  }

  if (postings.length === 0) {
    return (
      <section className="rounded-xl bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold">No saved postings yet</h1>
        <p className="mt-2 text-ink-muted">
          Contacts are added to a posting. Save the job first, then click the bookmark on this
          profile again.
        </p>
        <Link href="/" className={`${buttonClasses("secondary")} mt-4`}>
          Go to tracker
        </Link>
      </section>
    );
  }

  const options = (list: PostingChoice[]) =>
    list.map((p) => (
      <option key={p.id} value={p.id} disabled={p.alreadyAdded}>
        {postingLabel(p)}
      </option>
    ));

  return (
    <section className="rounded-xl bg-surface p-6 shadow-card">
      <h1 className="text-2xl font-semibold">Add LinkedIn contact</h1>
      <p className="mt-1 text-ink-muted">
        Check the details, then pick which saved posting they belong to.
        {profile.company && (
          <>
            {" "}
            Current company: <strong>{profile.company}</strong>.
          </>
        )}
      </p>
      <form onSubmit={form.onSubmit} noValidate className="mt-4 space-y-3">
        <Field id="opportunity_id" label="Posting" required error={errors.opportunity_id}>
          <select
            {...fieldAria("opportunity_id", errors.opportunity_id)}
            defaultValue={defaultPosting?.id ?? ""}
            onChange={(event) => {
              if (titleEdited) return;
              setTitle(titleFor(postings.find((p) => p.id === event.target.value)));
            }}
            className="input"
          >
            <option value="">Choose a posting…</option>
            {suggested.length > 0 ? (
              <>
                <optgroup label={`At ${profile.company}`}>{options(suggested)}</optgroup>
                <optgroup label="Other postings">{options(others)}</optgroup>
              </>
            ) : (
              options(others)
            )}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="name" label="Name" error={errors.name}>
            <input
              {...fieldAria("name", errors.name)}
              defaultValue={profile.name}
              maxLength={120}
              autoComplete="off"
              className="input"
            />
          </Field>
          <Field id="title" label="Title" error={errors.title}>
            <input
              {...fieldAria("title", errors.title)}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleEdited(true);
              }}
              maxLength={120}
              placeholder="e.g. Recruiter"
              className="input"
            />
          </Field>
          <Field
            id="linkedin_url"
            label="LinkedIn URL"
            error={errors.linkedin_url}
            className="sm:col-span-2"
          >
            <input
              {...fieldAria("linkedin_url", errors.linkedin_url)}
              type="url"
              defaultValue={profile.linkedin_url}
              maxLength={2048}
              className="input"
            />
          </Field>
        </div>
        <FormStatus error={form.error} />
        <div className="flex justify-end">
          <Button type="submit" pending={form.pending}>
            {form.pending ? "Adding…" : "Add contact"}
          </Button>
        </div>
      </form>
    </section>
  );
}
