import { z } from "zod";

import { TAG_COLORS } from "@/lib/domain/constants";

export const tagNameSchema = z
  .string()
  .trim()
  .min(1, "Tag name is required")
  .max(30, "Tag names can be at most 30 characters")
  // Collapse runs of whitespace so "AI  /  ML" and "AI / ML" don't both exist.
  .transform((v) => v.replace(/\s+/g, " "));

export const tagColorSchema = z.enum(TAG_COLORS, "Choose a color");

export const tagSchema = z.object({
  name: tagNameSchema,
  color: tagColorSchema.default("slate"),
});

export const tagUpdateSchema = z
  .object({
    name: tagNameSchema.optional(),
    color: tagColorSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.color !== undefined, "Nothing to update");
