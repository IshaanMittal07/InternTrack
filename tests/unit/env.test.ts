import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  APP_TIMEZONE: "America/Toronto",
};

async function loadEnv(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return (await import("@/lib/env")).env;
}

afterEach(() => vi.unstubAllEnvs());

// Warm the module graph once; the first cold import can be slow on Windows.
beforeAll(async () => {
  await import("zod");
}, 30_000);

describe("env", () => {
  it("reads the Supabase settings", async () => {
    const env = await loadEnv(base);
    expect(env().NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });

  it("defaults APP_TIMEZONE to UTC", async () => {
    const env = await loadEnv({ ...base, APP_TIMEZONE: "" });
    expect(env().APP_TIMEZONE).toBe("UTC");
  });

  it("rejects a bad time zone", async () => {
    const env = await loadEnv({ ...base, APP_TIMEZONE: "Mars/Olympus" });
    expect(() => env()).toThrow(/APP_TIMEZONE/);
  });

  it("fails closed when the Supabase URL is missing", async () => {
    const env = await loadEnv({ ...base, NEXT_PUBLIC_SUPABASE_URL: undefined });
    expect(() => env()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
