import { expect, test } from "@playwright/test";

import { clearInbox, waitForMagicLink } from "../support/mailpit";

import { SENT, signIn } from "./helpers";

test.describe("unauthenticated visitors", () => {
  for (const path of ["/", "/tags", "/export", "/?tab=applied&open=x", "/some/unknown/page"]) {
    test(`are redirected from ${path} to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Internship Tracker" })).toBeVisible();
    });
  }

  test("get no data from the CSV export", async ({ request }) => {
    const response = await request.get("/export", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toMatch(/\/login$/);
  });
});

test.describe("sign-in", () => {
  test("a brand-new email gets a sign-in link", async ({ page }) => {
    const email = `newcomer-${Date.now()}@test.local`;
    await clearInbox();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("status")).toHaveText(SENT);
    expect(await waitForMagicLink(email)).toContain("/auth/v1/verify");
  });

  test("an invalid email gets a validation message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("status")).toHaveText("Enter a valid email address.");
  });

  test("a bad or reused link is rejected", async ({ page }) => {
    await page.goto("/auth/callback?code=not-a-real-code");
    await expect(page).toHaveURL(/\/login\?error=link$/);
    await expect(page.getByText("That sign-in link is invalid or has expired")).toBeVisible();
  });
});

test.describe("signed-in owner", () => {
  test("can sign in with a magic link and sign out", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

    // Visiting /login while signed in goes back to the dashboard.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});
