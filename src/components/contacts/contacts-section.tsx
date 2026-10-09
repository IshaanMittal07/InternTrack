"use client";

import { useOptimistic, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Pill } from "@/components/ui/pill";
import {
  LINKEDIN_LABELS,
  LINKEDIN_TONES,
  OUTREACH_LABELS,
  OUTREACH_TONES,
} from "@/lib/domain/constants";
import { contactLabel } from "@/lib/domain/contact-label";
import { formatDate, isFollowUpOverdue } from "@/lib/domain/dates";
import { activeLinkedinConnection, contactProgress } from "@/lib/domain/summary";
import type { Contact } from "@/lib/domain/types";
import { deleteContactAction, setContactSpokenAction } from "@/server/actions/contacts";

import { ContactForm } from "./contact-form";

export function ContactsSection({
  opportunityId,
  contacts,
  today,
}: {
  opportunityId: string;
  contacts: Contact[];
  today: string;
}) {
  const [adding, setAdding] = useState(false);
  const progress = contactProgress(contacts);

  return (
    <div className="space-y-3">
      {progress && <p className="text-sm font-medium text-ink-muted">{progress}</p>}
      {contacts.length === 0 && !adding && (
        <p className="rounded-lg bg-surface-muted px-3 py-3 text-sm text-ink-muted">
          No contacts yet. Add recruiters, alumni or engineers you want to reach out to.
        </p>
      )}
      {contacts.length > 0 && (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <ContactItem key={c.id} contact={c} today={today} />
          ))}
        </ul>
      )}
      {adding ? (
        <div className="rounded-lg bg-surface-muted p-3">
          <ContactForm
            mode={{ kind: "create", opportunityId }}
            onDone={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <span aria-hidden="true">+</span> Add contact
        </Button>
      )}
    </div>
  );
}

function ContactItem({ contact, today }: { contact: Contact; today: string }) {
  const [editing, setEditing] = useState(false);
  const [spoken, setSpoken] = useOptimistic(contact.has_spoken);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const overdue = isFollowUpOverdue(contact.next_follow_up, today);
  const label = contactLabel(contact);
  const linkedin = activeLinkedinConnection(contact);

  function toggleSpoken() {
    setError(null);
    startTransition(async () => {
      setSpoken(!spoken);
      const result = await setContactSpokenAction(contact.id, !spoken);
      if (!result.ok) setError(result.error);
    });
  }

  if (editing) {
    return (
      <li className="rounded-lg bg-surface-muted p-3">
        <ContactForm
          mode={{ kind: "edit", contact }}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="space-y-2 rounded-lg bg-surface-muted p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium break-words">{label}</p>
          {contact.title && contact.title !== label && (
            <p className="text-sm text-ink-muted">{contact.title}</p>
          )}
        </div>
        <button
          type="button"
          aria-pressed={spoken}
          onClick={toggleSpoken}
          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
            spoken
              ? "bg-success-soft text-success ring-success"
              : "bg-surface text-ink-muted ring-line-strong hover:text-ink"
          }`}
        >
          {spoken ? "✓ Spoken with" : "Not spoken with yet"}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {contact.linkedin_url && (
          <a
            href={contact.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-text underline underline-offset-2"
          >
            LinkedIn<span className="sr-only"> profile of {label} (opens in new tab)</span>
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="break-all text-accent-text underline underline-offset-2"
          >
            {contact.email}
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Pill tone={OUTREACH_TONES[contact.outreach_status]}>
          {OUTREACH_LABELS[contact.outreach_status]}
        </Pill>
        {linkedin && <Pill tone={LINKEDIN_TONES[linkedin]}>{LINKEDIN_LABELS[linkedin]}</Pill>}
        {contact.last_contacted && <Pill>Last contacted {formatDate(contact.last_contacted)}</Pill>}
        {contact.next_follow_up && (
          <Pill tone={overdue ? "danger" : "neutral"}>
            {overdue ? "Follow-up overdue · " : "Follow up "}
            {formatDate(contact.next_follow_up)}
          </Pill>
        )}
      </div>

      {contact.notes && (
        <p className="text-sm whitespace-pre-line text-ink-muted">{contact.notes}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Edit<span className="sr-only"> {label}</span>
        </Button>
        <ConfirmButton
          title={`Delete ${label}?`}
          message="This contact will be permanently removed from this opportunity."
          confirmLabel="Delete contact"
          onConfirm={() => deleteContactAction(contact.id)}
        >
          Delete<span className="sr-only"> {label}</span>
        </ConfirmButton>
      </div>
    </li>
  );
}
