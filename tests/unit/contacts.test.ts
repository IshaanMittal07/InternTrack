import { describe, expect, it } from "vitest";

import type { Db } from "@/lib/domain/types";
import { createContact } from "@/server/services/contacts";

const USER = "11111111-1111-4111-8111-111111111111";
const OPP = "22222222-2222-4222-8222-222222222222";

/** Records the opportunity update createContact makes after inserting the contact. */
function fakeDb() {
  const calls: { patch?: Record<string, unknown>; filters: string[] } = { filters: [] };
  const db = {
    from: (table: string) => {
      if (table === "contacts") {
        return {
          insert: () => ({
            select: () => ({ single: async () => ({ data: { id: "c1" }, error: null }) }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { id: OPP }, error: null }) }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          calls.patch = patch;
          const chain = {
            eq: (column: string, value: unknown) => {
              calls.filters.push(`${column}=${String(value)}`);
              return chain;
            },
            or: async (filter: string) => {
              calls.filters.push(`or:${filter}`);
              return { error: null };
            },
          };
          return chain;
        },
      };
    },
  };
  return { db: db as unknown as Db, calls };
}

describe("createContact", () => {
  it("tags the posting 'Connection sent' when the contact has a LinkedIn link", async () => {
    const { db, calls } = fakeDb();
    const result = await createContact(db, USER, OPP, {
      name: "Jane",
      linkedin_url: "https://www.linkedin.com/in/jane/",
    });
    expect(result).toEqual({ ok: true, data: { id: "c1" } });
    expect(calls.patch).toEqual({ linkedin_connection: "sent" });
    expect(calls.filters).toEqual([
      `id=${OPP}`,
      `user_id=${USER}`,
      // Only an untracked or "unsent" posting changes; nothing else is overwritten.
      "or:linkedin_connection.is.null,linkedin_connection.eq.not_sent",
    ]);
  });

  it("leaves the posting alone for a contact without a LinkedIn link", async () => {
    const { db, calls } = fakeDb();
    const result = await createContact(db, USER, OPP, { name: "Jane" });
    expect(result.ok).toBe(true);
    expect(calls.patch).toBeUndefined();
  });
});
