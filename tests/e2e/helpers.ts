import { expect, type Page } from "@playwright/test";

import { clearInbox, waitForMagicLink } from "../support/mailpit";

export const OWNER = "owner@test.local";
export const NEUTRAL = "If this email is allowed, a link has been sent. Check your inbox.";

/** Signs in through the real magic-link flow, reading the email from Mailpit. */
export async function signIn(page: Page, email = OWNER) {
  await clearInbox();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toHaveText(NEUTRAL);
  const link = await waitForMagicLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/(\?.*)?$/);
}
