import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { applyFilters, DEFAULT_FILTERS } from "@/lib/domain/filters";
import * as contacts from "@/server/services/contacts";
import * as opportunities from "@/server/services/opportunities";
import { listOpportunities, listTags } from "@/server/services/queries";
import * as tags from "@/server/services/tags";

import { OTHER, OWNER, adminClient, ensureUser, must, signedInClient, type Db } from "./helpers";

/**
 * The service layer that every Server Action calls, exercised against the
 * real database as a signed-in user (so RLS applies too).
 */

let db: Db;
let otherDb: Db;
let userId: string;
let otherId: string;
const admin = adminClient();
const TODAY = "2026-10-01";

beforeAll(async () => {
  userId = await ensureUser(OWNER);
  otherId = await ensureUser(OTHER);
  db = await signedInClient(OWNER);
  otherDb = await signedInClient(OTHER);
});

beforeEach(async () => {
  await admin.from("opportunities").delete().in("user_id", [userId, otherId]);
  await admin.from("tags").delete().in("user_id", [userId, otherId]);
});

async function newOpportunity(fields: Record<string, unknown> = {}) {
  const result = await opportunities.createOpportunity(db, userId, {
    category: "planning",
    company: "Acme",
    ...fields,
  });
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

async function loadOpp(id: string) {
  return must(await admin.from("opportunities").select("*").eq("id", id).single());
}

describe("opportunities", () => {
  it("creates, updates and deletes", async () => {
    const id = await newOpportunity({ role_title: "Intern", posting_url: "https://x.com/job" });
    expect((await loadOpp(id)).role_title).toBe("Intern");

    const updated = await opportunities.updateOpportunity(db, userId, id, {
      company: "Acme Corp",
      priority: "high",
      deadline: "2026-10-10",
    });
    expect(updated.ok).toBe(true);
    const row = await loadOpp(id);
    expect(row).toMatchObject({ company: "Acme Corp", priority: "high", deadline: "2026-10-10" });
    expect(row.category).toBe("planning");

    expect((await opportunities.deleteOpportunity(db, userId, id)).ok).toBe(true);
    expect((await admin.from("opportunities").select("id").eq("id", id)).data).toEqual([]);
  });

  it("returns field errors for invalid input and writes nothing", async () => {
    const result = await opportunities.createOpportunity(db, userId, {
      category: "planning",
      company: "",
      posting_url: "javascript:alert(1)",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.company).toBeDefined();
      expect(result.fieldErrors?.posting_url).toBeDefined();
    }
    expect((await admin.from("opportunities").select("id").eq("user_id", userId)).data).toEqual([]);
  });

  it("an update cannot change the category", async () => {
    const id = await newOpportunity();
    await opportunities.updateOpportunity(db, userId, id, { company: "A", category: "applied" });
    expect((await loadOpp(id)).category).toBe("planning");
  });
});

describe("category moves", () => {
  it("Planning → Applied sets date applied (default today) and stage submitted", async () => {
    const id = await newOpportunity();
    expect((await opportunities.moveOpportunity(db, userId, { id, to: "applied" }, TODAY)).ok).toBe(
      true,
    );
    expect(await loadOpp(id)).toMatchObject({
      category: "applied",
      date_applied: TODAY,
      application_stage: "submitted",
    });
  });

  it("uses the chosen date applied", async () => {
    const id = await newOpportunity();
    await opportunities.moveOpportunity(
      db,
      userId,
      { id, to: "applied", date_applied: "2026-09-20" },
      TODAY,
    );
    expect((await loadOpp(id)).date_applied).toBe("2026-09-20");
  });

  it("Applied → Planning clears date applied and stage", async () => {
    const id = await newOpportunity({
      category: "applied",
      date_applied: "2026-09-01",
      application_stage: "interviewing",
    });
    expect(
      (await opportunities.moveOpportunity(db, userId, { id, to: "planning" }, TODAY)).ok,
    ).toBe(true);
    expect(await loadOpp(id)).toMatchObject({
      category: "planning",
      date_applied: null,
      application_stage: null,
    });
  });

  it("rejects invalid moves", async () => {
    const id = await newOpportunity();
    const bad = await opportunities.moveOpportunity(db, userId, { id, to: "archived" }, TODAY);
    expect(bad.ok).toBe(false);
  });
});

describe("contacts and referrals", () => {
  it("adds, edits, toggles spoken-with, and deletes a contact", async () => {
    const oppId = await newOpportunity();
    const created = await contacts.createContact(db, userId, oppId, {
      name: "Jane",
      email: "jane@example.com",
    });
    expect(created.ok).toBe(true);
    const contactId = created.ok ? created.data.id : "";

    expect(
      (
        await contacts.updateContact(db, userId, contactId, {
          name: "Jane Doe",
          title: "Recruiter",
        })
      ).ok,
    ).toBe(true);
    expect((await contacts.setContactSpoken(db, userId, contactId, true)).ok).toBe(true);

    const [opp] = await listOpportunities(db, userId);
    expect(opp?.contacts).toHaveLength(1);
    expect(opp?.contacts[0]).toMatchObject({
      name: "Jane Doe",
      title: "Recruiter",
      has_spoken: true,
    });

    expect((await contacts.deleteContact(db, userId, contactId)).ok).toBe(true);
    expect((await listOpportunities(db, userId))[0]?.contacts).toEqual([]);
  });

  it("sets a referral from one of the opportunity's own contacts", async () => {
    const oppId = await newOpportunity();
    const c = await contacts.createContact(db, userId, oppId, { name: "Ref" });
    const contactId = c.ok ? c.data.id : "";
    const result = await opportunities.setReferral(db, userId, oppId, {
      referral_status: "received",
      referred_by_contact_id: contactId,
    });
    expect(result.ok).toBe(true);
    expect(await loadOpp(oppId)).toMatchObject({
      referral_status: "received",
      referred_by_contact_id: contactId,
    });
  });

  it("refuses a referrer from a different opportunity", async () => {
    const a = await newOpportunity({ company: "A" });
    const b = await newOpportunity({ company: "B" });
    const c = await contacts.createContact(db, userId, b, { name: "Bea" });
    const result = await opportunities.setReferral(db, userId, a, {
      referral_status: "received",
      referred_by_contact_id: c.ok ? c.data.id : "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.referred_by_contact_id).toBeDefined();
    expect((await loadOpp(a)).referred_by_contact_id).toBeNull();
  });
});

describe("tags", () => {
  it("creates, assigns, filters, renames, recolors and deletes", async () => {
    const created = await tags.createTag(db, userId, { name: "Fintech", color: "amber" });
    expect(created.ok).toBe(true);
    const tagId = created.ok ? created.data.id : "";

    const tagged = await newOpportunity({ company: "Stripe" });
    await newOpportunity({ company: "Untagged" });
    expect((await tags.assignTag(db, userId, tagged, tagId)).ok).toBe(true);
    // Assigning twice is harmless.
    expect((await tags.assignTag(db, userId, tagged, tagId)).ok).toBe(true);

    const all = await listOpportunities(db, userId);
    const filtered = applyFilters(all, { ...DEFAULT_FILTERS, tab: "planning", tags: [tagId] });
    expect(filtered.map((o) => o.company)).toEqual(["Stripe"]);
    expect((await listTags(db, userId)).find((t) => t.id === tagId)?.usage).toBe(1);

    expect((await tags.updateTag(db, userId, tagId, { name: "FinTech" })).ok).toBe(true);
    expect((await tags.updateTag(db, userId, tagId, { color: "teal" })).ok).toBe(true);
    const renamed = (await listTags(db, userId)).find((t) => t.id === tagId);
    expect(renamed).toMatchObject({ name: "FinTech", color: "teal" });

    expect((await tags.deleteTag(db, userId, tagId)).ok).toBe(true);
    const after = await listOpportunities(db, userId);
    expect(after.map((o) => o.company).sort()).toEqual(["Stripe", "Untagged"]);
    expect(after.find((o) => o.company === "Stripe")?.tagIds).toEqual([]);
  });

  it("rejects duplicate names in any capitalization, on create and rename", async () => {
    expect((await tags.createTag(db, userId, { name: "Robotics" })).ok).toBe(true);
    for (const name of ["robotics", "ROBOTICS", " RoBoTiCs "]) {
      const dup = await tags.createTag(db, userId, { name });
      expect(dup.ok).toBe(false);
      if (!dup.ok) expect(dup.fieldErrors?.name).toMatch(/already have a tag/);
    }
    const other = await tags.createTag(db, userId, { name: "Space" });
    const rename = await tags.updateTag(db, userId, other.ok ? other.data.id : "", {
      name: "robotICS",
    });
    expect(rename.ok).toBe(false);
  });

  it("creating a tag inline reuses an existing one case-insensitively", async () => {
    const existing = await tags.createTag(db, userId, { name: "Cybersecurity" });
    const oppId = await newOpportunity();
    const result = await tags.assignTagByName(db, userId, oppId, "  cybersecurity ");
    expect(result.ok && result.data.tagId).toBe(existing.ok && existing.data.id);
    expect(await listTags(db, userId)).toHaveLength(1);

    const created = await tags.assignTagByName(db, userId, oppId, "Brand New");
    expect(created.ok).toBe(true);
    const [opp] = await listOpportunities(db, userId);
    expect(opp?.tagIds).toHaveLength(2);
  });

  it("unassigns a tag without deleting it", async () => {
    const t = await tags.createTag(db, userId, { name: "Temp" });
    const tagId = t.ok ? t.data.id : "";
    const oppId = await newOpportunity();
    await tags.assignTag(db, userId, oppId, tagId);
    expect((await tags.unassignTag(db, userId, oppId, tagId)).ok).toBe(true);
    expect((await listOpportunities(db, userId))[0]?.tagIds).toEqual([]);
    expect(await listTags(db, userId)).toHaveLength(1);
  });
});

describe("another user calling the services with the owner's ids", () => {
  it("can neither change nor delete anything", async () => {
    const oppId = await newOpportunity({ company: "Mine" });
    const c = await contacts.createContact(db, userId, oppId, { name: "Mine" });
    const contactId = c.ok ? c.data.id : "";
    const t = await tags.createTag(db, userId, { name: "Mine" });
    const tagId = t.ok ? t.data.id : "";

    const attempts = await Promise.all([
      opportunities.updateOpportunity(otherDb, otherId, oppId, { company: "Hacked" }),
      opportunities.deleteOpportunity(otherDb, otherId, oppId),
      opportunities.moveOpportunity(otherDb, otherId, { id: oppId, to: "applied" }, TODAY),
      opportunities.setReferral(otherDb, otherId, oppId, { referral_status: "declined" }),
      contacts.createContact(otherDb, otherId, oppId, { name: "Sneaky" }),
      contacts.updateContact(otherDb, otherId, contactId, { name: "Hacked" }),
      contacts.setContactSpoken(otherDb, otherId, contactId, true),
      contacts.deleteContact(otherDb, otherId, contactId),
      tags.updateTag(otherDb, otherId, tagId, { name: "Hacked" }),
      tags.deleteTag(otherDb, otherId, tagId),
      tags.assignTag(otherDb, otherId, oppId, tagId),
    ]);
    for (const result of attempts) expect(result.ok).toBe(false);

    const [opp] = await listOpportunities(db, userId);
    expect(opp).toMatchObject({
      company: "Mine",
      category: "planning",
      referral_status: "not_requested",
    });
    expect(opp?.contacts).toHaveLength(1);
    expect(opp?.contacts[0]).toMatchObject({ name: "Mine", has_spoken: false });
    expect(opp?.tagIds).toEqual([]);
    expect((await listTags(db, userId))[0]?.name).toBe("Mine");
  });
});
