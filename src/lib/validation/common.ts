import { z } from "zod";

import { isIsoDate } from "@/lib/domain/dates";

/** Form values arrive as strings; treat missing values as "". */
const asString = (value: unknown) => (value === null || value === undefined ? "" : value);

/** Optional free text: trimmed, length-limited, "" becomes null. */
export function optionalText(max: number, label = "This field") {
  return z.preprocess(
    asString,
    z
      .string()
      .trim()
      .max(max, `${label} must be at most ${max} characters`)
      .transform((v) => (v === "" ? null : v)),
  );
}

export function requiredText(max: number, label: string) {
  return z.preprocess(
    asString,
    z
      .string()
      .trim()
      .min(1, `${label} is required`)
      .max(max, `${label} must be at most ${max} characters`),
  );
}

/** Optional http(s) URL. Anything else (javascript:, data:, ...) is rejected. */
export const optionalUrl = z.preprocess(
  asString,
  z
    .string()
    .trim()
    .max(2048, "URL is too long")
    .refine((v) => {
      if (v === "") return true;
      if (/\s/.test(v)) return false;
      try {
        const url = new URL(v);
        return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
      } catch {
        return false;
      }
    }, "Enter a full link starting with http:// or https://")
    .transform((v) => (v === "" ? null : v)),
);

export const optionalEmail = z.preprocess(
  asString,
  z
    .string()
    .trim()
    .max(254, "Email is too long")
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address")
    .transform((v) => (v === "" ? null : v.toLowerCase())),
);

/** Optional calendar date in YYYY-MM-DD form. */
export const optionalDate = z.preprocess(
  asString,
  z
    .string()
    .trim()
    .refine((v) => v === "" || isIsoDate(v), "Enter a valid date")
    .transform((v) => (v === "" ? null : v)),
);

export const requiredDate = z.preprocess(
  asString,
  z.string().trim().refine(isIsoDate, "Enter a valid date"),
);

export const uuid = z.uuid("Invalid id");

/** Optional enum from a <select>, where "" means "not set". */
export function optionalEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess((v) => (v === "" || v === null ? undefined : v), z.enum(values).optional());
}

/** Turns FormData into a plain object of strings (files are ignored). */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}
