import type { Contact, OpportunityWithRelations } from "@/lib/domain/types";

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

export function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: id(),
    user_id: "u",
    opportunity_id: "o",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    name: "Contact",
    title: null,
    linkedin_url: null,
    email: null,
    has_spoken: false,
    last_contacted: null,
    next_follow_up: null,
    notes: null,
    ...overrides,
  };
}

export function makeOpportunity(
  overrides: Partial<OpportunityWithRelations> = {},
): OpportunityWithRelations {
  return {
    id: id(),
    user_id: "u",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    category: "planning",
    company: "Acme",
    role_title: null,
    posting_url: null,
    posting_notes: null,
    location: null,
    term: null,
    deadline: null,
    date_applied: null,
    application_stage: null,
    referral_status: "not_requested",
    referred_by_contact_id: null,
    priority: "medium",
    notes: null,
    contacts: [],
    tagIds: [],
    ...overrides,
  };
}
