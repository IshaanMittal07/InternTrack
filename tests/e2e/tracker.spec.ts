import { expect, test, type Page } from "@playwright/test";

import { adminClient, OWNER } from "../integration/helpers";

import { signIn } from "./helpers";

async function resetOwnerData() {
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const owner = data.users.find((u) => u.email === OWNER);
  if (!owner) throw new Error("owner missing");
  await admin.from("opportunities").delete().eq("user_id", owner.id);
  await admin.from("tags").delete().eq("user_id", owner.id);
}

function trackConsoleProblems(page: Page) {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(msg.text());
  });
  page.on("pageerror", (err) => problems.push(err.message));
  return problems;
}

test.beforeEach(async () => {
  await resetOwnerData();
});

test("full flow: create, contact, spoken-with, tags, tag filter, move to Applied", async ({
  page,
}) => {
  const problems = trackConsoleProblems(page);
  await signIn(page);

  // First sign-in seeded the default tags.
  await expect(page.getByRole("list", { name: "Opportunities per tag" })).toContainText(
    "Cybersecurity",
  );

  // Create a Planning opportunity.
  await page.getByRole("link", { name: /^Planning/ }).click();
  await expect(page.getByText("Nothing planned yet")).toBeVisible();
  await page.getByRole("button", { name: "Add opportunity" }).click();
  const create = page.getByRole("dialog", { name: "Add opportunity" });
  await create.getByLabel("Company").fill("Quantinuum");
  await create.getByLabel("Role").fill("Quantum Software Intern");
  await create.getByLabel("Posting notes").fill("Applications close on October 31.");
  await create.getByRole("button", { name: "Save opportunity" }).click();

  // The new opportunity opens in the drawer.
  const drawer = page.getByRole("dialog", { name: "Quantinuum" });
  await expect(drawer).toBeVisible();

  // Add a contact and toggle "spoken with".
  await drawer.getByRole("button", { name: "Add contact" }).click();
  const contactForm = drawer.getByRole("form", { name: "Add contact" });
  await contactForm.getByLabel("Name").fill("Jane Doe");
  await contactForm.getByLabel("Title").fill("Recruiter");
  await contactForm.getByRole("button", { name: "Add contact" }).click();
  await expect(drawer.getByText("0 of 1 contact spoken to")).toBeVisible();
  await drawer.getByRole("button", { name: "Not spoken with yet" }).click();
  await expect(drawer.getByRole("button", { name: "✓ Spoken with" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(drawer.getByText("1 of 1 contact spoken to")).toBeVisible();

  // Add an existing tag and create a new one inline.
  await drawer.getByRole("button", { name: "Add tag Quantum" }).click();
  await expect(drawer.getByRole("button", { name: "Remove tag Quantum" })).toBeVisible();
  await drawer.getByLabel("Add a tag").fill("Research");
  await drawer.getByLabel("Add a tag").press("Enter");
  await expect(drawer.getByRole("button", { name: "Remove tag Research" })).toBeVisible();

  // Close the drawer with Escape.
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();

  // A second, untagged opportunity to prove the filter works.
  await page.getByRole("button", { name: "Add opportunity" }).click();
  await create.getByLabel("Company").fill("Untagged Inc");
  await create.getByRole("button", { name: "Save opportunity" }).click();
  await expect(page.getByRole("dialog", { name: "Untagged Inc" })).toBeVisible();
  await page.keyboard.press("Escape");

  const cards = page.getByRole("region", { name: "Opportunities" }).getByRole("listitem");
  await expect(cards).toHaveCount(2);
  await expect(cards.filter({ hasText: "Quantinuum" })).toContainText("1 of 1 contact spoken to");

  // Filter by the Research tag.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator("summary", { hasText: "Tags" }).click();
  await page.getByRole("checkbox", { name: "Research" }).check();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Quantinuum");
  await expect(page).toHaveURL(/tags=/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("checkbox", { name: "Research" })).toBeHidden();

  // Move it from Planning to Applied.
  await cards.first().getByRole("link").click();
  await drawer.getByRole("button", { name: "Move to Applied" }).click();
  const moveDialog = page.getByRole("dialog", { name: "Move to Applied?" });
  await expect(moveDialog.getByLabel("Date applied")).not.toHaveValue("");
  await moveDialog.getByRole("button", { name: "Move to Applied" }).click();

  await expect(page).toHaveURL(/tab=applied/);
  await expect(drawer.getByLabel("Stage")).toHaveValue("submitted");
  await page.keyboard.press("Escape");
  const appliedCard = page.getByRole("region", { name: "Opportunities" }).getByRole("listitem");
  await expect(appliedCard).toHaveCount(1);
  await expect(appliedCard.first()).toContainText("Submitted");
  await expect(appliedCard.first()).toContainText("Applications close on October 31.");
  await expect(page.getByRole("link", { name: /^Applied/ })).toContainText("1");

  expect(problems).toEqual([]);
});

test("moving out of Applied asks for confirmation and clears the stage", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Add opportunity" }).click();
  const create = page.getByRole("dialog", { name: "Add opportunity" });
  await create.getByLabel("Company").fill("Stripe");
  await create.getByLabel("Stage").selectOption("interviewing");
  await create.getByRole("button", { name: "Save opportunity" }).click();

  const drawer = page.getByRole("dialog", { name: "Stripe" });
  await drawer.getByRole("button", { name: "Move to Planning" }).click();
  const confirm = page.getByRole("dialog", { name: "Move to Planning?" });
  await expect(confirm).toContainText("will be cleared");
  await confirm.getByRole("button", { name: "Move to Planning" }).click();

  await expect(page).toHaveURL(/tab=planning/);
  await expect(drawer.getByLabel("Stage")).toHaveCount(0);
});

test("deleting asks for confirmation, and the CSV export downloads", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Add opportunity" }).click();
  const create = page.getByRole("dialog", { name: "Add opportunity" });
  await create.getByLabel("Company").fill("=Formula Co");
  await create.getByRole("button", { name: "Save opportunity" }).click();
  await expect(page.getByRole("dialog", { name: "=Formula Co" })).toBeVisible();
  await page.keyboard.press("Escape");

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("Company");
  expect(csv).toContain("'=Formula Co");

  await page.getByRole("region", { name: "Opportunities" }).getByRole("link").first().click();
  const drawer = page.getByRole("dialog", { name: "=Formula Co" });
  await drawer.getByRole("button", { name: "Delete this opportunity" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete =Formula Co?" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Delete this opportunity" }).click();
  await confirm.getByRole("button", { name: "Delete opportunity" }).click();
  await expect(page.getByText("No applications yet")).toBeVisible();
});

test("manage tags: rename, recolor, duplicate rejected, delete keeps opportunities", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Manage tags" }).click();
  await expect(page.getByRole("heading", { name: "Manage tags" })).toBeVisible();

  const rowFor = (name: string) =>
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: `Delete tag ${name}` }) });

  const row = rowFor("Hardware");
  await row.getByLabel("Name").fill("Chips");
  await row.getByLabel("Color").selectOption("teal");
  await row.getByRole("button", { name: "Save tag Hardware" }).click();
  await expect(rowFor("Chips")).toBeVisible();
  await expect(rowFor("Chips").getByLabel("Color")).toHaveValue("teal");

  await page.getByLabel("Name").first().fill("cybersecurity");
  await page.getByRole("button", { name: "Create tag" }).click();
  await expect(page.getByText(/already have a tag/)).toBeVisible();

  await rowFor("Chips").getByRole("button", { name: "Delete tag Chips" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete tag" }).click();
  await expect(rowFor("Chips")).toHaveCount(0);
  await expect(rowFor("Quantum")).toBeVisible();
});
