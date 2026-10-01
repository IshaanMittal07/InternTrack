"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormStatus } from "@/components/ui/form-status";
import { Modal } from "@/components/ui/modal";
import { useFormAction } from "@/components/ui/use-form-action";
import { CATEGORY_LABELS, type Category } from "@/lib/domain/constants";
import { createOpportunityAction } from "@/server/actions/opportunities";

import { OpportunityFields } from "./opportunity-fields";

export function NewOpportunityButton({
  defaultCategory,
  today,
  label = "Add opportunity",
  variant = "primary",
}: {
  defaultCategory: Category;
  today: string;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>(defaultCategory);

  const form = useFormAction(
    (formData) => {
      formData.set("category", category);
      return createOpportunityAction(null, formData);
    },
    ({ id }) => {
      setOpen(false);
      // Open the new opportunity so contacts and tags can be added right away.
      router.push(`/?tab=${category}&open=${id}`, { scroll: false });
    },
  );

  return (
    <>
      <Button
        variant={variant}
        onClick={() => {
          setCategory(defaultCategory);
          form.reset();
          setOpen(true);
        }}
      >
        <span aria-hidden="true">+</span> {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add opportunity"
        description={`It will be saved under ${CATEGORY_LABELS[category]}.`}
      >
        <form onSubmit={form.onSubmit} noValidate className="space-y-4">
          <OpportunityFields
            prefix="new"
            category={category}
            onCategoryChange={setCategory}
            errors={form.fieldErrors}
            today={today}
          />
          <FormStatus error={form.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={form.pending}>
              Cancel
            </Button>
            <Button type="submit" pending={form.pending}>
              {form.pending ? "Saving…" : "Save opportunity"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
