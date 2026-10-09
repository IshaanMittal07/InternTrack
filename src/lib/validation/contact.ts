import { z } from "zod";

import { OUTREACH_STATUSES } from "@/lib/domain/constants";

import { optionalDate, optionalEmail, optionalText, optionalUrl } from "./common";

export const contactSchema = z.object({
  name: optionalText(120, "Name"),
  title: optionalText(120, "Title"),
  linkedin_url: optionalUrl,
  email: optionalEmail,
  outreach_status: z.enum(OUTREACH_STATUSES, "Choose a message status").default("not_sent"),
  has_spoken: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  last_contacted: optionalDate,
  next_follow_up: optionalDate,
  notes: optionalText(10_000, "Notes"),
});

export type ContactInput = z.output<typeof contactSchema>;
