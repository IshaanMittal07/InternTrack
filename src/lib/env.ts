import { z } from "zod";

/**
 * Server-side configuration, validated on first use.
 *
 * Only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are public.
 * APP_TIMEZONE is server-only and never sent to the browser.
 * The Supabase service role key is intentionally NOT part of the app's config.
 */

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  APP_TIMEZONE: z
    .string()
    .trim()
    .optional()
    .transform((tz) => tz || "UTC")
    .refine(isValidTimeZone, "APP_TIMEZONE must be an IANA time zone, e.g. America/Toronto"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (typeof window !== "undefined") {
    throw new Error("env() must only be called on the server");
  }
  if (!cached) {
    const parsed = schema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      APP_TIMEZONE: process.env.APP_TIMEZONE,
    });
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid or missing environment variables: ${fields}`);
    }
    cached = parsed.data;
  }
  return cached;
}
