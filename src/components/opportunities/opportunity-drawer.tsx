"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { ContactsSection } from "@/components/contacts/contacts-section";
import { ReferralSection } from "@/components/contacts/referral-section";
import { TagPicker } from "@/components/tags/tag-picker";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Modal } from "@/components/ui/modal";
import { CATEGORY_LABELS } from "@/lib/domain/constants";
import type { OpportunityWithRelations, Tag } from "@/lib/domain/types";
import { deleteOpportunityAction } from "@/server/actions/opportunities";

import { DetailsForm } from "./details-form";
import { MoveCategory } from "./move-category";

export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-3 border-t border-line pt-5 first:border-t-0 first:pt-0"
    >
      <div>
        <h3 id={id} className="text-lg font-semibold">
          {title}
        </h3>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Side panel with everything about one opportunity. */
export function OpportunityDrawer({
  opportunity,
  tags,
  today,
  closeHref,
}: {
  opportunity: OpportunityWithRelations;
  tags: Tag[];
  today: string;
  closeHref: string;
}) {
  const router = useRouter();
  const close = () => router.push(closeHref, { scroll: false });
  const subtitle = [opportunity.role_title, CATEGORY_LABELS[opportunity.category]]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal open onClose={close} variant="drawer" title={opportunity.company} description={subtitle}>
      <div className="space-y-6 pb-6">
        <Section id="drawer-tags" title="Tags">
          <TagPicker
            opportunityId={opportunity.id}
            allTags={tags}
            selectedIds={opportunity.tagIds}
          />
        </Section>

        <Section id="drawer-details" title="Details">
          <DetailsForm
            key={`${opportunity.id}-${opportunity.category}`}
            opportunity={opportunity}
            today={today}
          />
        </Section>

        <Section
          id="drawer-category"
          title="Category"
          description={`Currently in ${CATEGORY_LABELS[opportunity.category]}.`}
        >
          <MoveCategory opportunity={opportunity} today={today} />
        </Section>

        <Section
          id="drawer-contacts"
          title="Contacts"
          description="People to network with for this opportunity."
        >
          <ContactsSection
            opportunityId={opportunity.id}
            contacts={opportunity.contacts}
            today={today}
          />
        </Section>

        <Section id="drawer-referral" title="Referral">
          <ReferralSection
            key={`${opportunity.referral_status}-${opportunity.referred_by_contact_id}`}
            opportunity={opportunity}
          />
        </Section>

        <Section id="drawer-danger" title="Delete">
          <ConfirmButton
            variant="danger"
            title={`Delete ${opportunity.company}?`}
            message="This permanently deletes the opportunity with its contacts and notes. Tags themselves are kept."
            confirmLabel="Delete opportunity"
            onConfirm={() => deleteOpportunityAction(opportunity.id)}
            onDone={close}
          >
            Delete this opportunity
          </ConfirmButton>
        </Section>
      </div>
    </Modal>
  );
}
