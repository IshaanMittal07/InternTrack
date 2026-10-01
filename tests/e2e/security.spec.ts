import { expect, test } from "@playwright/test";

test.describe("security headers and CSP", () => {
  test("pages load with no CSP violations or console errors", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || /content security policy/i.test(msg.text())) {
        problems.push(msg.text());
      }
    });
    page.on("pageerror", (err) => problems.push(err.message));

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Client-side JS ran (hydration succeeded under the strict CSP).
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

    // The not-found page also renders cleanly under the CSP.
    const missing = await page.goto("/this-page-does-not-exist");
    expect(missing?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

    const nonHttpProblems = problems.filter((p) => !/status of 404/.test(p));
    expect(nonHttpProblems).toEqual([]);
  });

  test("every Next.js script carries the per-request nonce", async ({ page }) => {
    const response = await page.goto("/");
    const csp = response?.headers()["content-security-policy"] ?? "";
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();

    const scripts = await page
      .locator("script")
      .evaluateAll((els) => els.map((el) => (el as HTMLScriptElement).nonce));
    expect(scripts.length).toBeGreaterThan(0);
    for (const value of scripts) expect(value).toBe(nonce);
  });

  test("nonce changes on every request", async ({ request }) => {
    const a = (await request.get("/")).headers()["content-security-policy"];
    const b = (await request.get("/")).headers()["content-security-policy"];
    expect(a).toBeTruthy();
    expect(a).not.toEqual(b);
  });

  test("security headers are present", async ({ request }) => {
    const headers = (await request.get("/")).headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("robots.txt disallows all crawling", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/User-agent: \*/);
    expect(body).toMatch(/Disallow: \/\s*$/m);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });

  test("dark mode follows the system setting", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(26, 23, 20)");
    await context.close();
  });
});
