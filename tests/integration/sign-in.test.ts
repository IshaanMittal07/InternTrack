import { beforeAll, describe, expect, it } from "vitest";

import { NEUTRAL_MESSAGE, requestMagicLink } from "@/server/auth/request-magic-link";

import { clearInbox, messagesTo, waitForMagicLink } from "../support/mailpit";

import { OTHER, OWNER, allowEmail, anonClient, ensureUser } from "./helpers";

/**
 * Exercises the real sign-in path against local Supabase + Mailpit: only the
 * ALLOWED_EMAIL gets an email, and every address sees the same message.
 */

const sendLink = (email: string) =>
  anonClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: "http://localhost:3000/auth/callback" },
  });

beforeAll(async () => {
  await allowEmail(OWNER, true);
  await ensureUser(OWNER);
  // OTHER is a real, confirmed account, so this proves the app-level check
  // stops the email even for an existing user.
  await ensureUser(OTHER);
});

describe("sign-in with ALLOWED_EMAIL lock", () => {
  it("emails a magic link to the allowed address", async () => {
    await clearInbox();
    const result = await requestMagicLink({
      rawEmail: ` ${OWNER.toUpperCase()} `,
      allowedEmail: OWNER,
      sendLink,
    });
    expect(result).toEqual({ status: "sent", message: NEUTRAL_MESSAGE });
    expect(await waitForMagicLink(OWNER)).toContain("/auth/v1/verify");
  });

  it("sends nothing to another address and shows the same message", async () => {
    await clearInbox();
    for (const email of [OTHER, "nobody@test.local"]) {
      const result = await requestMagicLink({ rawEmail: email, allowedEmail: OWNER, sendLink });
      expect(result).toEqual({ status: "sent", message: NEUTRAL_MESSAGE });
    }
    await new Promise((r) => setTimeout(r, 1500));
    expect(await messagesTo(OTHER)).toEqual([]);
    expect(await messagesTo("nobody@test.local")).toEqual([]);
  });

  it("Supabase itself refuses to create accounts for unknown emails", async () => {
    const { error } = await anonClient().auth.signInWithOtp({
      email: "nobody@test.local",
      options: { shouldCreateUser: false },
    });
    expect(error).not.toBeNull();
  });
});
