import { z } from "zod";

import {
  CATEGORIES,
  LINKEDIN_CONNECTIONS,
  PRIORITIES,
  REFERRAL_STATUSES,
  STAGES,
} from "@/lib/domain/constants";

import {
  optionalDate,
  optionalEnum,
  optionalText,
  optionalUrl,
  requiredText,
  uuid,
} from "./common";

/**
 * Opportunity fields as edited in the forms. Applied opportunities must have
 * a date applied and a stage; other categories never do (the database enforces
 * the same rule with check constraints).
 */
export const opportunitySchema = z
  .object({
    category: z.enum(CATEGORIES, "Choose a category"),
    company: requiredText(120, "Company"),
    role_title: optionalText(200, "Role"),
    posting_url: optionalUrl,
    posting_notes: optionalText(10_000, "Posting notes"),
    location: optionalText(200, "Location"),
    term: optionalText(60, "Term"),
    deadline: optionalDate,
    date_applied: optionalDate,
    application_stage: optionalEnum(STAGES),
    priority: optionalEnum(PRIORITIES).transform((p) => p ?? "medium"),
    linkedin_connection: optionalEnum(LINKEDIN_CONNECTIONS).transform((v) => v ?? null),
    notes: optionalText(20_000, "Notes"),
  })
  .superRefine((value, ctx) => {
    if (value.category === "applied" && !value.date_applied) {
      ctx.addIssue({
        code: "custom",
        path: ["date_applied"],
        message: "Date applied is required for applications",
      });
    }
  })
  .transform((value) => {
    if (value.category === "applied") {
      return { ...value, application_stage: value.application_stage ?? "submitted" };
    }
    return { ...value, date_applied: null, application_stage: null };
  });

export type OpportunityInput = z.output<typeof opportunitySchema>;

export const moveSchema = z.object({
  id: uuid,
  to: z.enum(CATEGORIES, "Choose a category"),
  date_applied: optionalDate,
});

export const referralSchema = z.object({
  referral_status: z.enum(REFERRAL_STATUSES, "Choose a referral status"),
  referred_by_contact_id: z.preprocess((v) => (v === "" ? null : v), uuid.nullable()),
});
