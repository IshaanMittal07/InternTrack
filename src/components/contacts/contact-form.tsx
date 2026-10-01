"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { useFormAction } from "@/components/ui/use-form-action";
import type { Contact } from "@/lib/domain/types";
import { createContactAction, updateContactAction } from "@/server/actions/contacts";

type Mode = { kind: "create"; opportunityId: string } | { kind: "edit"; contact: Contact };

export function ContactForm({
  mode,
  onDone,
  onCancel,
}: {
  mode: Mode;
  onDone: () => void;
  onCancel: () => void;
}) {
  const prefix = useId();
  const values: Partial<Contact> = mode.kind === "edit" ? mode.contact : {};
  const form = useFormAction<unknown>(
    (formData) =>
      mode.kind === "create"
        ? createContactAction(mode.opportunityId, null, formData)
        : updateContactAction(mode.contact.id, null, formData),
    () => onDone(),
  );
  const errors = form.fieldErrors;
  const id = (name: string) => `${prefix}-${name}`;
  const aria = (name: string) => ({
    id: id(name),
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id(name)}-error` : undefined,
  });

  return (
    <form
      onSubmit={form.onSubmit}
      noValidate
      className="space-y-3"
      aria-label={mode.kind === "create" ? "Add contact" : `Edit ${values.name}`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={id("name")} label="Name" required error={errors.name}>
          <input
            {...aria("name")}
            defaultValue={values.name ?? ""}
            required
            maxLength={120}
            autoComplete="off"
            className="input"
          />
        </Field>
        <Field id={id("title")} label="Title" error={errors.title}>
          <input
            {...aria("title")}
            defaultValue={values.title ?? ""}
            maxLength={120}
            placeholder="e.g. Recruiter"
            className="input"
          />
        </Field>
        <Field id={id("linkedin_url")} label="LinkedIn URL" error={errors.linkedin_url}>
          <input
            {...aria("linkedin_url")}
            type="url"
            inputMode="url"
            defaultValue={values.linkedin_url ?? ""}
            maxLength={2048}
            placeholder="https://www.linkedin.com/in/…"
            className="input"
          />
        </Field>
        <Field id={id("email")} label="Email" error={errors.email}>
          <input
            {...aria("email")}
            type="email"
            defaultValue={values.email ?? ""}
            maxLength={254}
            autoComplete="off"
            className="input"
          />
        </Field>
        <Field id={id("last_contacted")} label="Last contacted" error={errors.last_contacted}>
          <input
            {...aria("last_contacted")}
            type="date"
            defaultValue={values.last_contacted ?? ""}
            className="input"
          />
        </Field>
        <Field id={id("next_follow_up")} label="Next follow-up" error={errors.next_follow_up}>
          <input
            {...aria("next_follow_up")}
            type="date"
            defaultValue={values.next_follow_up ?? ""}
            className="input"
          />
        </Field>
        <Field id={id("notes")} label="Notes" error={errors.notes} className="sm:col-span-2">
          <textarea
            {...aria("notes")}
            defaultValue={values.notes ?? ""}
            maxLength={10_000}
            rows={2}
            className="input"
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="has_spoken"
          defaultChecked={values.has_spoken ?? false}
          className="size-4 accent-accent"
        />
        I have spoken with this person
      </label>
      <FormStatus error={form.error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={form.pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" pending={form.pending}>
          {form.pending ? "Saving…" : mode.kind === "create" ? "Add contact" : "Save contact"}
        </Button>
      </div>
    </form>
  );
}
