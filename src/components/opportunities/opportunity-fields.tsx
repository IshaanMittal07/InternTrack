"use client";

import { Field } from "@/components/ui/field";
import type { FieldErrors } from "@/lib/action-result";
import {
  CATEGORIES,
  CATEGORY_LABELS,
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
  const id = (name: string) => `${prefix}-${name}`;
  const aria = (name: string) => ({
    id: id(name),
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id(name)}-error` : undefined,
  });

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
          defaultValue={values.company ?? ""}
          required
          maxLength={120}
          autoComplete="off"
          className="input"
        />
      </Field>
      <Field id={id("role_title")} label="Role" error={errors.role_title}>
        <input
          {...aria("role_title")}
          defaultValue={values.role_title ?? ""}
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
          defaultValue={values.posting_url ?? ""}
          maxLength={2048}
          placeholder="https://"
          className="input"
        />
      </Field>
      <Field id={id("location")} label="Location" error={errors.location}>
        <input
          {...aria("location")}
          defaultValue={values.location ?? ""}
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
          defaultValue={values.deadline ?? ""}
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
        id={id("posting_notes")}
        label="Posting notes"
        error={errors.posting_notes}
        className="sm:col-span-2"
      >
        <textarea
          {...aria("posting_notes")}
          defaultValue={values.posting_notes ?? ""}
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
