import { beforeAll, describe, expect, it } from "vitest";

import {
  OTHER,
  OWNER,
  STRANGER,
  adminClient,
  allowEmail,
  anonClient,
  ensureUser,
  must,
  signedInClient,
  type Db,
} from "./helpers";

/**
 * Proves Row Level Security isolates data: a second (allowlisted) user, an
 * unlisted user, and an anonymous visitor cannot read, insert, update or
 * delete anything belonging to the owner, in ANY table.
 */

const TABLES = ["opportunities", "contacts", "tags", "opportunity_tags"] as const;

let ownerId: string;
let otherId: string;
let owner: Db;
let other: Db;
let stranger: Db;
const admin = adminClient();

const ids = {
  ownerOpp: "",
  ownerContact: "",
  ownerTag: "",
  otherOpp: "",
  otherContact: "",
  otherTag: "",
};

beforeAll(async () => {
  await allowEmail(OWNER, true);
  await allowEmail(OTHER, true);
  await allowEmail(STRANGER, false);
  ownerId = await ensureUser(OWNER);
  otherId = await ensureUser(OTHER);
  await ensureUser(STRANGER);
  owner = await signedInClient(OWNER);
  other = await signedInClient(OTHER);
  stranger = await signedInClient(STRANGER);

  ids.ownerOpp = must(
    await owner
      .from("opportunities")
      .insert({ category: "planning", company: "Owner Co" })
      .select("id")
      .single(),
  ).id;
  ids.ownerContact = must(
    await owner
      .from("contacts")
      .insert({ opportunity_id: ids.ownerOpp, name: "Owner Contact" })
      .select("id")
      .single(),
  ).id;
  ids.ownerTag = must(
    await owner.from("tags").insert({ name: "OwnerTag", color: "sage" }).select("id").single(),
  ).id;
  must(
    await owner
      .from("opportunity_tags")
      .insert({ opportunity_id: ids.ownerOpp, tag_id: ids.ownerTag })
      .select()
      .single(),
  );

  ids.otherOpp = must(
    await other
      .from("opportunities")
      .insert({ category: "interested", company: "Other Co" })
      .select("id")
      .single(),
  ).id;
  ids.otherContact = must(
    await other
      .from("contacts")
      .insert({ opportunity_id: ids.otherOpp, name: "Other Contact" })
      .select("id")
      .single(),
  ).id;
  ids.otherTag = must(
    await other.from("tags").insert({ name: "OtherTag", color: "plum" }).select("id").single(),
  ).id;
});

async function ownerRowCounts() {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const { count, error } = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("user_id", ownerId);
    if (error) throw error;
    counts[table] = count ?? 0;
  }
  return counts;
}

describe("owner sees their own data", () => {
  it.each(TABLES)("can read own %s", async (table) => {
    const { data, error } = await owner.from(table).select("*");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });
});

describe("second user cannot touch the owner's data", () => {
  it.each(TABLES)("cannot read owner's %s", async (table) => {
    const { data, error } = await other.from(table).select("*").eq("user_id", ownerId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot update the owner's rows in any table", async () => {
    const before = await ownerRowCounts();
    const results = await Promise.all([
      other.from("opportunities").update({ company: "Hacked" }).eq("id", ids.ownerOpp).select(),
      other.from("contacts").update({ name: "Hacked" }).eq("id", ids.ownerContact).select(),
      other.from("tags").update({ name: "Hacked" }).eq("id", ids.ownerTag).select(),
      other
        .from("opportunity_tags")
        .update({ tag_id: ids.otherTag })
        .eq("opportunity_id", ids.ownerOpp)
        .select(),
    ]);
    for (const { data } of results) expect(data ?? []).toEqual([]);

    const opp = must(
      await admin.from("opportunities").select("company").eq("id", ids.ownerOpp).single(),
    );
    expect(opp.company).toBe("Owner Co");
    const contact = must(
      await admin.from("contacts").select("name").eq("id", ids.ownerContact).single(),
    );
    expect(contact.name).toBe("Owner Contact");
    const tag = must(await admin.from("tags").select("name").eq("id", ids.ownerTag).single());
    expect(tag.name).toBe("OwnerTag");
    expect(await ownerRowCounts()).toEqual(before);
  });

  it("cannot delete the owner's rows in any table", async () => {
    const before = await ownerRowCounts();
    await other.from("opportunity_tags").delete().eq("opportunity_id", ids.ownerOpp);
    await other.from("contacts").delete().eq("id", ids.ownerContact);
    await other.from("tags").delete().eq("id", ids.ownerTag);
    await other.from("opportunities").delete().eq("id", ids.ownerOpp);
    expect(await ownerRowCounts()).toEqual(before);
  });

  it("cannot insert rows owned by the owner", async () => {
    const results = await Promise.all([
      other.from("opportunities").insert({ user_id: ownerId, category: "planning", company: "X" }),
      other.from("tags").insert({ user_id: ownerId, name: "Injected" }),
      other
        .from("contacts")
        .insert({ user_id: ownerId, opportunity_id: ids.ownerOpp, name: "Injected" }),
      other
        .from("opportunity_tags")
        .insert({ user_id: ownerId, opportunity_id: ids.ownerOpp, tag_id: ids.ownerTag }),
    ]);
    for (const { error } of results) expect(error?.code).toBe("42501");
  });

  it("cannot attach their own contact to the owner's opportunity", async () => {
    const { error } = await other
      .from("contacts")
      .insert({ opportunity_id: ids.ownerOpp, name: "Sneaky" });
    expect(error?.code).toBe("42501");
  });

  it("cannot move their contact onto the owner's opportunity", async () => {
    const { error } = await other
      .from("contacts")
      .update({ opportunity_id: ids.ownerOpp })
      .eq("id", ids.otherContact);
    expect(error?.code).toBe("42501");
  });

  it("cannot link their tag to the owner's opportunity", async () => {
    const { error } = await other
      .from("opportunity_tags")
      .insert({ opportunity_id: ids.ownerOpp, tag_id: ids.otherTag });
    expect(error?.code).toBe("42501");
  });

  it("cannot link the owner's tag to their own opportunity", async () => {
    const { error } = await other
      .from("opportunity_tags")
      .insert({ opportunity_id: ids.otherOpp, tag_id: ids.ownerTag });
    expect(error?.code).toBe("42501");
  });

  it("cannot reference the owner's contact as their referrer", async () => {
    const { error } = await other
      .from("opportunities")
      .update({ referred_by_contact_id: ids.ownerContact })
      .eq("id", ids.otherOpp);
    expect(error).not.toBeNull();
  });

  it("cannot see the owner's rows through the seed function", async () => {
    expect((await other.rpc("seed_default_tags")).error).toBeNull();
    const { data } = await other.from("tags").select("user_id");
    for (const row of data ?? []) expect(row.user_id).toBe(otherId);
  });
});

describe("a signed-in user who is NOT on the allowlist", () => {
  it.each(TABLES)("cannot read %s at all", async (table) => {
    const { data, error } = await stranger.from(table).select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot insert even their own rows", async () => {
    const { error } = await stranger
      .from("opportunities")
      .insert({ category: "planning", company: "Stranger Co" });
    expect(error?.code).toBe("42501");
    const { error: tagError } = await stranger.from("tags").insert({ name: "S" });
    expect(tagError?.code).toBe("42501");
  });
});

describe("anonymous visitors (no session)", () => {
  const anon = anonClient();

  it.each(TABLES)("have no access to %s", async (table) => {
    const { data, error } = await anon.from(table).select("*");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("cannot insert", async () => {
    const { error } = await anon
      .from("opportunities")
      .insert({ category: "planning", company: "Anon" });
    expect(error?.code).toBe("42501");
  });

  it("cannot call the tag seeding function", async () => {
    const { error } = await anon.rpc("seed_default_tags");
    expect(error).not.toBeNull();
  });
});

describe("public sign-up is disabled", () => {
  it("rejects new accounts via sign-up and via magic link", async () => {
    const anon = anonClient();
    const email = `newcomer-${Date.now()}@test.local`;
    const signUp = await anon.auth.signUp({ email, password: "a-long-password-123" });
    expect(signUp.error).not.toBeNull();
    const otp = await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    expect(otp.error).not.toBeNull();
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(data.users.some((u) => u.email === email)).toBe(false);
  });
});
