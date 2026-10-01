"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { useFormAction } from "@/components/ui/use-form-action";
import { TAG_COLORS, TAG_COLOR_LABELS } from "@/lib/domain/constants";
import { createTagAction } from "@/server/actions/tags";

export function NewTagForm() {
  const form = useFormAction(
    (formData) => createTagAction(null, formData),
    (_data, el) => el.reset(),
  );

  return (
    <form onSubmit={form.onSubmit} noValidate className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <Field
          id="new-tag-name"
          label="Name"
          error={form.fieldErrors.name}
          className="min-w-48 flex-1"
        >
          <input
            id="new-tag-name"
            name="name"
            required
            maxLength={30}
            autoComplete="off"
            aria-invalid={form.fieldErrors.name ? true : undefined}
            aria-describedby={form.fieldErrors.name ? "new-tag-name-error" : undefined}
            className="input"
          />
        </Field>
        <Field id="new-tag-color" label="Color">
          <select id="new-tag-color" name="color" defaultValue="slate" className="input">
            {TAG_COLORS.map((c) => (
              <option key={c} value={c}>
                {TAG_COLOR_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" pending={form.pending}>
          {form.pending ? "Creating…" : "Create tag"}
        </Button>
      </div>
      <FormStatus
        error={form.fieldErrors.name ? null : form.error}
        success={form.result?.ok ? "Tag created." : null}
      />
    </form>
  );
}
