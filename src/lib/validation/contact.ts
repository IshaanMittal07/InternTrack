import { z } from "zod";

import { optionalDate, optionalEmail, optionalText, optionalUrl, requiredText } from "./common";

export const contactSchema = z.object({
  name: requiredText(120, "Name"),
  title: optionalText(120, "Title"),
  linkedin_url: optionalUrl,
  email: optionalEmail,
  has_spoken: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  last_contacted: optionalDate,
  next_follow_up: optionalDate,
  notes: optionalText(10_000, "Notes"),
});

export type ContactInput = z.output<typeof contactSchema>;
