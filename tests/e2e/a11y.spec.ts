import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { OWNER, adminClient } from "../integration/helpers";

import { signIn } from "./helpers";

/**
 * Automated accessibility scan (axe, WCAG 2.1 A/AA rules, including color
 * contrast) of every page, in light and dark mode, with realistic data.
 */

async function seed() {
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ownerId = data.users.find((u) => u.email === OWNER)!.id;
  await admin.from("opportunities").delete().eq("user_id", ownerId);
  await admin.from("tags").delete().eq("user_id", ownerId);

  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);

  const { data: tag } = await admin
    .from("tags")
    .insert([
      { user_id: ownerId, name: "Cybersecurity", color: "terracotta" },
      { user_id: ownerId, name: "Quantum", color: "plum" },
      { user_id: ownerId, name: "AI/ML", color: "sage" },
      { user_id: ownerId, name: "Hardware", color: "slate" },
      { user_id: ownerId, name: "Fintech", color: "amber" },
      { user_id: ownerId, name: "Research", color: "teal" },
    ])
    .select("id");
  const { data: opps } = await admin
    .from("opportunities")
    .insert(
      [
        {
          user_id: ownerId,
          category: "applied",
          company: "Quantinuum",
          role_title: "Quantum Software Intern",
          date_applied: today,
          application_stage: "interviewing",
          referral_status: "received",
          priority: "high",
          term: "Summer 2027",
        },
        {
          user_id: ownerId,
          category: "planning",
          company: "CrowdStrike",
          role_title: "Security Engineering Intern",
          deadline: soon,
          referral_status: "requested",
        },
        { user_id: ownerId, category: "planning", company: "Late Co", deadline: past },
      ],
      { defaultToNull: false },
    )
    .select("id");
  await admin.from("contacts").insert(
    [
      {
        user_id: ownerId,
        opportunity_id: opps![0]!.id,
        name: "Jane Doe",
        title: "Recruiter",
        has_spoken: true,
        next_follow_up: past,
        linkedin_url: "https://www.linkedin.com/in/example",
        email: "jane@example.com",
      },
      { user_id: ownerId, opportunity_id: opps![0]!.id, name: "Sam Lee" },
    ],
    { defaultToNull: false },
  );
  await admin.from("opportunity_tags").insert(
    tag!.slice(0, 6).map((t, i) => ({
      user_id: ownerId,
      opportunity_id: opps![i % 3]!.id,
      tag_id: t.id,
    })),
  );
  return opps![0]!.id;
}

async function scan(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
  );
  expect(summary, `axe violations on ${name}`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test(`no accessibility violations (${scheme})`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    const shot = (name: string) =>
      page.screenshot({
        path: `test-results/screens/${info.project.name}-${scheme}-${name}.png`,
        fullPage: true,
      });

    await page.goto("/login");
    await scan(page, "login");
    await shot("login");

    const firstId = await seed();
    await signIn(page);
    await expect(page.getByRole("heading", { name: "Your internship search" })).toBeVisible();
    await scan(page, "dashboard");
    await shot("dashboard");

    await page.goto("/?tab=planning");
    await expect(page.getByText("CrowdStrike")).toBeVisible();
    await scan(page, "planning");
    await shot("planning");

    await page.goto("/?tab=interested");
    await expect(page.getByText("No companies saved yet")).toBeVisible();
    await scan(page, "empty state");

    await page.goto(`/?tab=applied&open=${firstId}`);
    const drawer = page.getByRole("dialog", { name: "Quantinuum" });
    await expect(drawer).toBeVisible();
    await scan(page, "drawer");
    await shot("drawer");

    // Focus stays inside the open drawer.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () => document.activeElement?.closest("dialog[open]") !== null,
      );
      expect(inside).toBe(true);
    }

    await page.goto("/tags");
    await expect(page.getByRole("heading", { name: "Manage tags" })).toBeVisible();
    await scan(page, "tags");
    await shot("tags");
  });
}
