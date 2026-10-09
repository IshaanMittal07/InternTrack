import { beforeAll, describe, expect, it } from "vitest";

import type { TablesInsert } from "@/lib/supabase/database.types";

import { OWNER, adminClient, ensureUser, must, signedInClient, type Db } from "./helpers";

/** Database-level rules: check constraints, triggers, cascades, seeding. */

let owner: Db;
let ownerId: string;
const admin = adminClient();

beforeAll(async () => {
  ownerId = await ensureUser(OWNER);
  owner = await signedInClient(OWNER);
});

async function newOpp(fields: Partial<TablesInsert<"opportunities">> = {}) {
  return must(
    await owner
      .from("opportunities")
      .insert({ category: "planning", company: "Acme", ...fields })
      .select("*")
      .single(),
  );
}

describe("opportunity check constraints", () => {
  it("rejects an applied opportunity without a date and stage", async () => {
    const { error } = await owner
      .from("opportunities")
      .insert({ category: "applied", company: "A" });
    expect(error?.code).toBe("23514");
  });

  it("rejects a planning opportunity with a stage", async () => {
    const { error } = await owner
      .from("opportunities")
      .insert({ category: "planning", company: "A", application_stage: "submitted" });
    expect(error?.code).toBe("23514");
  });

  it("accepts an applied opportunity with both date and stage", async () => {
    const opp = await newOpp({
      category: "applied",
      date_applied: "2026-09-01",
      application_stage: "submitted",
    });
    expect(opp.referral_status).toBe("not_requested");
    expect(opp.priority).toBe("medium");
  });

  it("rejects non-http posting URLs and over-long company names", async () => {
    const bad = await owner
      .from("opportunities")
      .insert({ category: "planning", company: "A", posting_url: "javascript:alert(1)" });
    expect(bad.error?.code).toBe("23514");
    const long = await owner
      .from("opportunities")
      .insert({ category: "planning", company: "x".repeat(121) });
    expect(long.error?.code).toBe("23514");
  });
});

describe("updated_at trigger", () => {
  it("bumps updated_at on update", async () => {
    const opp = await newOpp();
    await new Promise((r) => setTimeout(r, 20));
    const updated = must(
      await owner
        .from("opportunities")
        .update({ notes: "changed" })
        .eq("id", opp.id)
        .select("updated_at")
        .single(),
    );
    expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(
      new Date(opp.updated_at).getTime(),
    );
  });
});

describe("referral foreign key", () => {
  it("requires the referrer to be a contact of the same opportunity", async () => {
    const a = await newOpp({ company: "A" });
    const b = await newOpp({ company: "B" });
    const contactOfB = must(
      await owner
        .from("contacts")
        .insert({ opportunity_id: b.id, name: "Bea" })
        .select("id")
        .single(),
    );
    const { error } = await owner
      .from("opportunities")
      .update({ referred_by_contact_id: contactOfB.id })
      .eq("id", a.id);
    expect(error?.code).toBe("23503");
  });

  it("clears the referrer when that contact is deleted, keeping the opportunity", async () => {
    const opp = await newOpp();
    const contact = must(
      await owner
        .from("contacts")
        .insert({ opportunity_id: opp.id, name: "Ref" })
        .select("id")
        .single(),
    );
    must(
      await owner
        .from("opportunities")
        .update({ referred_by_contact_id: contact.id, referral_status: "received" })
        .eq("id", opp.id)
        .select()
        .single(),
    );
    await owner.from("contacts").delete().eq("id", contact.id);
    const after = must(
      await owner
        .from("opportunities")
        .select("referred_by_contact_id, referral_status")
        .eq("id", opp.id)
        .single(),
    );
    expect(after.referred_by_contact_id).toBeNull();
    expect(after.referral_status).toBe("received");
  });

  it("deletes an opportunity that has a referrer, cascading its contacts", async () => {
    const opp = await newOpp();
    const contact = must(
      await owner
        .from("contacts")
        .insert({ opportunity_id: opp.id, name: "Ref" })
        .select("id")
        .single(),
    );
    must(
      await owner
        .from("opportunities")
        .update({ referred_by_contact_id: contact.id })
        .eq("id", opp.id)
        .select()
        .single(),
    );
    const { error } = await owner.from("opportunities").delete().eq("id", opp.id);
    expect(error).toBeNull();
    const { data } = await admin.from("contacts").select("id").eq("id", contact.id);
    expect(data).toEqual([]);
  });
});

describe("tags", () => {
  it("rejects duplicate names in any capitalization", async () => {
    must(await owner.from("tags").insert({ name: "Fintech" }).select().single());
    for (const name of ["fintech", "FINTECH", "FinTech"]) {
      const { error } = await owner.from("tags").insert({ name });
      expect(error?.code).toBe("23505");
    }
  });

  it("deleting a tag unlinks it but keeps opportunities", async () => {
    const opp = await newOpp();
    const tag = must(await owner.from("tags").insert({ name: "Temp" }).select("id").single());
    must(
      await owner
        .from("opportunity_tags")
        .insert({ opportunity_id: opp.id, tag_id: tag.id })
        .select()
        .single(),
    );
    await owner.from("tags").delete().eq("id", tag.id);
    const links = await owner.from("opportunity_tags").select("*").eq("tag_id", tag.id);
    expect(links.data).toEqual([]);
    const stillThere = await owner.from("opportunities").select("id").eq("id", opp.id);
    expect(stillThere.data).toHaveLength(1);
  });
});

describe("seed_default_tags", () => {
  it("seeds the five defaults once and is idempotent", async () => {
    await admin.from("tags").delete().eq("user_id", ownerId);
    expect((await owner.rpc("seed_default_tags")).error).toBeNull();
    expect((await owner.rpc("seed_default_tags")).error).toBeNull();
    const { data } = await owner.from("tags").select("name").order("name");
    expect(data?.map((t) => t.name)).toEqual([
      "AI/ML",
      "Cybersecurity",
      "Hardware",
      "Quantum",
      "Software Engineering",
    ]);
  });

  it("does nothing when the user already has tags", async () => {
    await admin.from("tags").delete().eq("user_id", ownerId);
    must(await owner.from("tags").insert({ name: "Mine" }).select().single());
    await owner.rpc("seed_default_tags");
    const { data } = await owner.from("tags").select("name");
    expect(data?.map((t) => t.name)).toEqual(["Mine"]);
  });
});
