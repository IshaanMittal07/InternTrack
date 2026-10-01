"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { useFormAction } from "@/components/ui/use-form-action";
import { REFERRAL_LABELS, REFERRAL_STATUSES } from "@/lib/domain/constants";
import type { OpportunityWithRelations } from "@/lib/domain/types";
import { setReferralAction } from "@/server/actions/opportunities";

export function ReferralSection({ opportunity }: { opportunity: OpportunityWithRelations }) {
  const form = useFormAction((formData) => setReferralAction(opportunity.id, null, formData));
  const errors = form.fieldErrors;

  return (
    <form onSubmit={form.onSubmit} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="referral-status" label="Referral status" error={errors.referral_status}>
          <select
            id="referral-status"
            name="referral_status"
            defaultValue={opportunity.referral_status}
            className="input"
          >
            {REFERRAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {REFERRAL_LABELS[s].replace("Referral ", "").replace(/^./, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="referral-contact"
          label="Referred by"
          error={errors.referred_by_contact_id}
          hint={
            opportunity.contacts.length === 0
              ? "Add a contact first to pick a referrer."
              : undefined
          }
        >
          <select
            id="referral-contact"
            name="referred_by_contact_id"
            defaultValue={opportunity.referred_by_contact_id ?? ""}
            disabled={opportunity.contacts.length === 0}
            aria-describedby={
              errors.referred_by_contact_id
                ? "referral-contact-error"
                : opportunity.contacts.length === 0
                  ? "referral-contact-hint"
                  : undefined
            }
            className="input"
          >
            <option value="">No one selected</option>
            {opportunity.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.title ? ` (${c.title})` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <FormStatus error={form.error} success={form.result?.ok ? "Referral saved." : null} />
        <Button type="submit" size="sm" pending={form.pending}>
          {form.pending ? "Saving…" : "Save referral"}
        </Button>
      </div>
    </form>
  );
}
