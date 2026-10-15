import { describe, expect, it } from "vitest";

import type { PostingDetails } from "@/lib/domain/posting";
import type { Db } from "@/lib/domain/types";
import { checkVisaSponsorship } from "@/server/services/visa-check";

const USER = "11111111-1111-4111-8111-111111111111";
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

type Row = { id: string; posting_url: string | null; posting_notes: string | null };

/** A fake Supabase client that serves `rows` and records updates with their filters. */
function fakeDb(rows: Row[]) {
  const updates: { patch: Record<string, unknown>; filters: string[] }[] = [];
  const loadFilters: string[] = [];
  const db = {
    from: () => ({
      select: () => {
        const chain = {
          eq: (c: string, v: unknown) => (loadFilters.push(`${c}=${String(v)}`), chain),
          is: (c: string, v: unknown) => (loadFilters.push(`${c} is ${String(v)}`), chain),
          in: async (c: string, v: string[]) => {
            loadFilters.push(`${c} in ${v.length}`);
            return { data: rows.filter((r) => v.includes(r.id)), error: null };
          },
        };
        return chain;
      },
      update: (patch: Record<string, unknown>) => {
        const entry = { patch, filters: [] as string[] };
        updates.push(entry);
        const chain = {
          eq: (c: string, v: unknown) => (entry.filters.push(`${c}=${String(v)}`), chain),
          is: async (c: string, v: unknown) => {
            entry.filters.push(`${c} is ${String(v)}`);
            return { error: null };
          },
        };
        return chain;
      },
    }),
  };
  return { db: db as unknown as Db, updates, loadFilters };
}

describe("checkVisaSponsorship", () => {
  it("saves what the re-read posting says, and only into empty postings", async () => {
    const { db, updates, loadFilters } = fakeDb([
      { id: id(1), posting_url: "https://jobs.example/1", posting_notes: null },
    ]);
    const read = async (): Promise<PostingDetails> => ({ visa_sponsorship: "yes" });
    const result = await checkVisaSponsorship(db, USER, [id(1)], read);
    expect(result).toEqual({ ok: true, data: { results: [{ id: id(1), visa: "yes" }] } });
    expect(loadFilters).toContain("visa_sponsorship is null");
    expect(updates).toEqual([
      {
        patch: { visa_sponsorship: "yes" },
        filters: [`id=${id(1)}`, `user_id=${USER}`, "visa_sponsorship is null"],
      },
    ]);
  });

  it("falls back to an explicit statement in the saved notes when the link can't be read", async () => {
    const { db, updates } = fakeDb([
      { id: id(1), posting_url: "https://jobs.example/1", posting_notes: "No visa sponsorship." },
      { id: id(2), posting_url: null, posting_notes: "Visa sponsorship is available." },
    ]);
    const read = async (): Promise<PostingDetails> => {
      throw new Error("blocked");
    };
    const result = await checkVisaSponsorship(db, USER, [id(1), id(2)], read);
    expect(result.ok && result.data.results).toEqual([
      { id: id(1), visa: "no" },
      { id: id(2), visa: "yes" },
    ]);
    // Postings are checked in parallel, so updates can land in any order.
    expect(updates.map((u) => u.patch)).toHaveLength(2);
    expect(updates.map((u) => u.patch)).toEqual(
      expect.arrayContaining([{ visa_sponsorship: "no" }, { visa_sponsorship: "yes" }]),
    );
  });

  it("leaves a posting empty rather than guessing", async () => {
    const { db, updates } = fakeDb([
      // Readable, but only a meta snippet with no statement.
      { id: id(1), posting_url: "https://jobs.example/1", posting_notes: "Great team." },
      // Unreadable and no notes.
      { id: id(2), posting_url: "https://jobs.example/2", posting_notes: null },
    ]);
    const read = async (url: string): Promise<PostingDetails> => {
      if (url.endsWith("/2")) throw new Error("404");
      return { company: "Acme" };
    };
    const result = await checkVisaSponsorship(db, USER, [id(1), id(2)], read);
    expect(result.ok && result.data.results).toEqual([
      { id: id(1), visa: null },
      { id: id(2), visa: null },
    ]);
    expect(updates).toEqual([]);
  });

  it("rejects bad or oversized batches", async () => {
    const { db } = fakeDb([]);
    const read = async () => ({});
    expect((await checkVisaSponsorship(db, USER, ["nope"], read)).ok).toBe(false);
    expect((await checkVisaSponsorship(db, USER, [], read)).ok).toBe(false);
    const six = [1, 2, 3, 4, 5, 6].map(id);
    expect((await checkVisaSponsorship(db, USER, six, read)).ok).toBe(false);
  });
});
