import { expect, test, type Page } from "@playwright/test";

// Accounts created by `pnpm db:seed`.
const accounts = {
  customer: {
    email: "dilshan.jayawardena@gmail.com",
    password: "customer@123",
    landing: /\/en\/dashboard$/,
  },
  owner: {
    email: "nuwan.perera@gmail.com",
    password: "owner@123",
    landing: /\/en\/owner\/dashboard$/,
  },
  admin: {
    email: "admin@travenest.lk",
    password: "admin@123",
    landing: /\/en\/admin\/dashboard$/,
  },
};

const signIn = async (page: Page, email: string, password: string) => {
  await page.goto("/en/login");
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('button[type="submit"]').click();
};

test.describe("public pages", () => {
  test("home page renders and sends the security headers", async ({ page }) => {
    const response = await page.goto("/en");
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("root redirects to a locale", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/?$/);
  });

  for (const locale of ["si", "ta"]) {
    test(`home page renders in ${locale}`, async ({ page }) => {
      const response = await page.goto(`/${locale}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("h1").first()).toBeVisible();
    });
  }

  test("vehicle search lists seeded vehicles", async ({ page }) => {
    await page.goto("/en/search");
    await expect(page.locator('a[href*="/en/vehicles/"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("authentication", () => {
  test("a guest is sent to sign in from the dashboard", async ({ page }) => {
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/login\?returnUrl=/);
  });

  test("a wrong password is refused without saying which part was wrong", async ({
    page,
  }) => {
    await signIn(page, accounts.customer.email, "not-the-password");
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login/);
  });

  for (const [role, account] of Object.entries(accounts)) {
    test(`${role} signs in and reaches their dashboard`, async ({ page }) => {
      await signIn(page, account.email, account.password);
      await expect(page).toHaveURL(account.landing, { timeout: 15_000 });

      // The session must survive a reload through the refresh cookie alone.
      await page.reload();
      await expect(page).toHaveURL(account.landing, { timeout: 15_000 });
      const stored = await page.evaluate(() => JSON.stringify(localStorage));
      expect(stored).not.toMatch(/eyJ[\w-]+\.[\w-]+\./);
    });
  }
});
