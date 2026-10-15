"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { bookmarkletHref, contactBookmarkletHref } from "@/lib/domain/bookmarklet";

/**
 * A bookmark button to drag onto the bookmarks bar, plus a copy-address
 * fallback. Browsers show no icon for javascript: bookmarks, so the emoji at
 * the start of the button's text (which becomes the bookmark's name) is its icon.
 */
function DraggableBookmark({
  href,
  icon,
  label,
}: {
  href: (origin: string) => string;
  icon: string;
  label: string;
}) {
  const name = `${icon} ${label}`;
  const link = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // React refuses javascript: links in JSX, so the address is set directly.
    link.current?.setAttribute("href", href(window.location.origin));
  }, [href]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href(window.location.origin));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink">
        <li>Show your bookmarks bar (Ctrl+Shift+B, or ⌘+Shift+B on a Mac).</li>
        <li>
          Drag this button onto the bookmarks bar:{" "}
          <a
            ref={link}
            onClick={(event) => event.preventDefault()}
            className="ml-1 inline-block cursor-grab rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-on-accent shadow-card"
          >
            {name}
          </a>
        </li>
      </ol>
      <p className="mt-4 text-sm text-ink-muted">
        Can&apos;t drag it? Copy its address below, then add a new bookmark by hand named &quot;
        {name}&quot; and paste the address as its URL.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={copy}>
          Copy bookmark URL
        </Button>
        <span role="status" aria-live="polite" className="text-sm text-success">
          {copied ? "Copied" : ""}
        </span>
      </div>
    </>
  );
}

/** The draggable bookmarks ("Save to tracker", "Add LinkedIn contact") and how to install them. */
export function BookmarkletSetup() {
  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">Save to tracker</h1>
        <p className="mt-1 text-ink-muted">
          A bookmark that adds the job you just applied to, in one click.
        </p>
      </div>

      <section aria-labelledby="install-heading" className="rounded-xl bg-surface p-5 shadow-card">
        <h2 id="install-heading" className="text-lg font-semibold">
          Add the bookmark
        </h2>
        <DraggableBookmark href={bookmarkletHref} icon="💼" label="Save to tracker" />
      </section>

      <section aria-labelledby="use-heading" className="rounded-xl bg-surface p-5 shadow-card">
        <h2 id="use-heading" className="text-lg font-semibold">
          Use it
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink">
          <li>
            After you submit an application, go back to the job posting and click{" "}
            <strong>Save to tracker</strong>. A new tab confirms what was saved.
          </li>
          <li>
            It is saved under Applied with today&apos;s date, with the company, role, location and
            description filled in when the page has them.
          </li>
          <li>
            If the posting is already in your tracker (for example under Planning), it is moved to
            Applied instead of being added twice.
          </li>
          <li>
            Click it on the job posting itself rather than the &quot;thanks for applying&quot; page,
            which often doesn&apos;t say which job it was.
          </li>
          <li>Stay signed in to the tracker in this browser.</li>
        </ul>
      </section>

      <section aria-labelledby="contact-heading" className="rounded-xl bg-surface p-5 shadow-card">
        <h2 id="contact-heading" className="text-lg font-semibold">
          Add LinkedIn contacts
        </h2>
        <p className="mt-1 text-ink-muted">
          A second bookmark that adds the person whose LinkedIn profile you&apos;re viewing as a
          contact on a posting you already saved.
        </p>
        <DraggableBookmark href={contactBookmarkletHref} icon="👤" label="Add LinkedIn contact" />
        <ul className="mt-4 list-disc space-y-2 pl-5 text-ink">
          <li>
            Open someone&apos;s profile on LinkedIn and click <strong>Add LinkedIn contact</strong>.
          </li>
          <li>
            A new tab shows their name, title and profile link, filled in from the page. Postings at
            their current company are suggested first; pick one and click{" "}
            <strong>Add contact</strong>.
          </li>
          <li>
            The title is their job title at the posting&apos;s company, taken from the Experience
            section of their profile, and changes if you pick a different posting.
          </li>
          <li>
            It never creates a new posting, and a posting they&apos;re already a contact on
            can&apos;t be picked twice.
          </li>
        </ul>
      </section>
    </>
  );
}
