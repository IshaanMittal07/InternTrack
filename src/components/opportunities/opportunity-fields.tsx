"use client";

import { useRef, useState } from "react";

import { Field } from "@/components/ui/field";
import type { FieldErrors } from "@/lib/action-result";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  LINKEDIN_CONNECTIONS,
  PRIORITIES,
  PRIORITY_LABELS,
  STAGES,
  STAGE_LABELS,
  type Category,
} from "@/lib/domain/constants";
import type { Opportunity } from "@/lib/domain/types";

type Values = Partial<
  Pick<
    Opportunity,
    | "company"
    | "role_title"
    | "posting_url"
    | "posting_notes"
    | "location"
    | "term"
    | "deadline"
    | "date_applied"
    | "application_stage"
    | "priority"
    | "linkedin_connection"
    | "notes"
  >
>;

/** The editable fields of an opportunity, shared by the create and edit forms. */
export function OpportunityFields({
  prefix,
  category,
  values = {},
  errors,
  today,
  onCategoryChange,
}: {
  prefix: string;
  category: Category;
  values?: Values;
  errors: FieldErrors;
  today: string;
  /** When provided, a category picker is shown (create form only). */
  onCategoryChange?: (category: Category) => void;
}) {
  const [company, setCompany] = useState(values.company ?? "");
  const [roleTitle, setRoleTitle] = useState(values.role_title ?? "");
  const [postingUrl, setPostingUrl] = useState(values.posting_url ?? "");
  const [location, setLocation] = useState(values.location ?? "");
  const [deadline, setDeadline] = useState(values.deadline ?? "");
  const [postingNotes, setPostingNotes] = useState(values.posting_notes ?? "");
  const companyRef = useRef(company);
  const roleTitleRef = useRef(roleTitle);
  const locationRef = useRef(location);
  const deadlineRef = useRef(deadline);
  const postingNotesRef = useRef(postingNotes);
  const [autofillPending, setAutofillPending] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState("");
  const postingUrlRef = useRef(postingUrl);
  const lastRequestedUrl = useRef(postingUrl);
  const autofillRequest = useRef(0);
  const id = (name: string) => `${prefix}-${name}`;
  const aria = (name: string) => ({
    id: id(name),
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id(name)}-error` : undefined,
  });

  // Reads the ref, not state, so it also works right after a paste.
  const autofillFromPosting = async () => {
    const url = postingUrlRef.current.trim();
    if (!url || url === lastRequestedUrl.current) return;
    lastRequestedUrl.current = url;
    const requestId = ++autofillRequest.current;
    setAutofillPending(true);
    setAutofillStatus("Reading posting…");

    try {
      const response = await fetch("/api/posting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = (await response.json()) as {
        details?: Partial<
          Pick<Opportunity, "company" | "role_title" | "location" | "deadline" | "posting_notes">
        >;
        error?: string;
      };

      if (!response.ok || !result.details) {
        throw new Error(result.error ?? "Could not read this posting.");
      }
      if (postingUrlRef.current.trim() !== url || autofillRequest.current !== requestId) return;

      const filled: string[] = [];
      if (!companyRef.current.trim() && result.details.company) {
        companyRef.current = result.details.company;
        setCompany(result.details.company);
        filled.push("company");
      }
      if (!roleTitleRef.current.trim() && result.details.role_title) {
        roleTitleRef.current = result.details.role_title;
        setRoleTitle(result.details.role_title);
        filled.push("role");
      }
      if (!locationRef.current.trim() && result.details.location) {
        locationRef.current = result.details.location;
        setLocation(result.details.location);
        filled.push("location");
      }
      if (!deadlineRef.current && result.details.deadline) {
        deadlineRef.current = result.details.deadline;
        setDeadline(result.details.deadline);
        filled.push("deadline");
      }
      if (!postingNotesRef.current.trim() && result.details.posting_notes) {
        postingNotesRef.current = result.details.posting_notes;
        setPostingNotes(result.details.posting_notes);
        filled.push("posting notes");
      }
      setAutofillStatus(
        filled.length ? `Filled ${filled.join(", ")}.` : "No empty fields could be filled.",
      );
    } catch (error) {
      if (autofillRequest.current === requestId) {
        lastRequestedUrl.current = "";
        setAutofillStatus(error instanceof Error ? error.message : "Could not read this posting.");
      }
    } finally {
      if (autofillRequest.current === requestId) setAutofillPending(false);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {onCategoryChange && (
        <Field id={id("category")} label="Category" required className="sm:col-span-2">
          <select
            {...aria("category")}
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as Category)}
            className="input"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field id={id("company")} label="Company" required error={errors.company}>
        <input
          {...aria("company")}
          value={company}
          onChange={(event) => {
            companyRef.current = event.target.value;
            setCompany(event.target.value);
          }}
          required
          maxLength={120}
          autoComplete="off"
          className="input"
        />
      </Field>
      <Field id={id("role_title")} label="Role" error={errors.role_title}>
        <input
          {...aria("role_title")}
          value={roleTitle}
          onChange={(event) => {
            roleTitleRef.current = event.target.value;
            setRoleTitle(event.target.value);
          }}
          maxLength={200}
          autoComplete="off"
          placeholder={category === "interested" ? "Optional" : "e.g. Software Engineering Intern"}
          className="input"
        />
      </Field>

      {category === "applied" && (
        <>
          <Field id={id("date_applied")} label="Date applied" required error={errors.date_applied}>
            <input
              {...aria("date_applied")}
              type="date"
              defaultValue={values.date_applied ?? today}
              required
              className="input"
            />
          </Field>
          <Field id={id("application_stage")} label="Stage" error={errors.application_stage}>
            <select
              {...aria("application_stage")}
              defaultValue={values.application_stage ?? "submitted"}
              className="input"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      <Field
        id={id("posting_url")}
        label="Posting link"
        error={errors.posting_url}
        className="sm:col-span-2"
      >
        <input
          {...aria("posting_url")}
          type="url"
          inputMode="url"
          value={postingUrl}
          onChange={(event) => {
            postingUrlRef.current = event.target.value;
            autofillRequest.current += 1;
            lastRequestedUrl.current = "";
            setPostingUrl(event.target.value);
            setAutofillStatus("");
            setAutofillPending(false);
          }}
          onBlur={autofillFromPosting}
          // Autofill as soon as a link is pasted; onChange runs first and
          // stores the new value in postingUrlRef.
          onPaste={() => setTimeout(autofillFromPosting, 0)}
          maxLength={2048}
          placeholder="https://"
          className="input"
        />
        <p className="mt-1 min-h-5 text-sm text-ink-muted" aria-live="polite">
          {autofillPending ? "Reading posting…" : autofillStatus}
        </p>
      </Field>
      <Field id={id("location")} label="Location" error={errors.location}>
        <input
          {...aria("location")}
          value={location}
          onChange={(event) => {
            locationRef.current = event.target.value;
            setLocation(event.target.value);
          }}
          maxLength={200}
          className="input"
        />
      </Field>
      <Field id={id("term")} label="Term" error={errors.term}>
        <input
          {...aria("term")}
          defaultValue={values.term ?? ""}
          maxLength={60}
          placeholder="e.g. Summer 2027"
          className="input"
        />
      </Field>
      <Field id={id("deadline")} label="Deadline" error={errors.deadline}>
        <input
          {...aria("deadline")}
          type="date"
          value={deadline}
          onChange={(event) => {
            deadlineRef.current = event.target.value;
            setDeadline(event.target.value);
          }}
          className="input"
        />
      </Field>
      <Field id={id("priority")} label="Priority" error={errors.priority}>
        <select {...aria("priority")} defaultValue={values.priority ?? "medium"} className="input">
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p].replace(" priority", "")}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id={id("linkedin_connection")}
        label="LinkedIn connection"
        hint="The tag is removed once you message a contact for this posting."
        error={errors.linkedin_connection}
      >
        <select
          {...aria("linkedin_connection")}
          aria-describedby={
            errors.linkedin_connection
              ? `${id("linkedin_connection")}-error`
              : `${id("linkedin_connection")}-hint`
          }
          defaultValue={values.linkedin_connection ?? ""}
          className="input"
        >
          <option value="">Not tracked</option>
          {LINKEDIN_CONNECTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "sent" ? "Connection sent" : "Connection unsent"}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id={id("posting_notes")}
        label="Posting notes"
        error={errors.posting_notes}
        className="sm:col-span-2"
      >
        <textarea
          {...aria("posting_notes")}
          value={postingNotes}
          onChange={(event) => {
            postingNotesRef.current = event.target.value;
            setPostingNotes(event.target.value);
          }}
          maxLength={10_000}
          rows={3}
          className="input"
        />
      </Field>
      <Field id={id("notes")} label="Notes" error={errors.notes} className="sm:col-span-2">
        <textarea
          {...aria("notes")}
          defaultValue={values.notes ?? ""}
          maxLength={20_000}
          rows={4}
          className="input"
        />
      </Field>
    </div>
  );
}
