"use client";

import { Button } from "@/components/ui/button";
import { FormStatus } from "@/components/ui/form-status";
import { useFormAction } from "@/components/ui/use-form-action";
import type { Opportunity } from "@/lib/domain/types";
import { updateOpportunityAction } from "@/server/actions/opportunities";

import { OpportunityFields } from "./opportunity-fields";

export function DetailsForm({ opportunity, today }: { opportunity: Opportunity; today: string }) {
  const form = useFormAction((formData) => updateOpportunityAction(opportunity.id, null, formData));

  return (
    <form onSubmit={form.onSubmit} noValidate className="space-y-4">
      <OpportunityFields
        prefix="edit"
        category={opportunity.category}
        values={opportunity}
        errors={form.fieldErrors}
        today={today}
      />
      <div className="flex items-center justify-between gap-3">
        <FormStatus error={form.error} success={form.result?.ok ? "Saved." : null} />
        <Button type="submit" pending={form.pending}>
          {form.pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
