import { describe, expect, it } from "vitest";

import { SENT_MESSAGE, requestMagicLink } from "@/server/auth/request-magic-link";

import { clearInbox, waitForMagicLink } from "../support/mailpit";

import { OWNER, adminClient, anonClient, ensureUser } from "./helpers";

/**
 * Exercises the real sign-in path against local Supabase + Mailpit: any
 * address gets a magic link, and a new address gets a new account.
 */

const sendLink = (email: string) =>
  anonClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: "http://localhost:3000/auth/callback" },
  });

describe("open sign-in", () => {
  it("emails a magic link to an existing account", async () => {
    await ensureUser(OWNER);
    await clearInbox();
    const result = await requestMagicLink({ rawEmail: ` ${OWNER.toUpperCase()} `, sendLink });
    expect(result).toEqual({ status: "sent", message: SENT_MESSAGE });
    expect(await waitForMagicLink(OWNER)).toContain("/auth/v1/verify");
  });

  it("creates an account and emails a link for a brand-new address", async () => {
    const email = `newcomer-${Date.now()}@test.local`;
    await clearInbox();
    const result = await requestMagicLink({ rawEmail: email, sendLink });
    expect(result).toEqual({ status: "sent", message: SENT_MESSAGE });
    expect(await waitForMagicLink(email)).toContain("/auth/v1/verify");

    const { data } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
    const user = data.users.find((u) => u.email === email);
    expect(user).toBeDefined();
    await adminClient().auth.admin.deleteUser(user!.id);
  });
});
