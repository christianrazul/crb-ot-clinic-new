import { expect, test } from "@playwright/test";

test("home redirects to the role home without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Good morning, Camelia" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("pages send a nonce CSP and the security headers", async ({ page }) => {
  const response = await page.goto("/login");
  const headers = response!.headers();
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).not.toContain("unsafe-eval");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(headers["strict-transport-security"]).toContain("max-age=63072000");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("same-origin");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-powered-by"]).toBeUndefined();

  // Each request gets a fresh nonce, and the inline theme script carries it.
  const nonce = csp.match(/'nonce-([^']+)'/)![1];
  const again = (await page.request.get("/login")).headers()["content-security-policy"];
  expect(again).not.toContain(nonce!);
  const themeScriptNonce = await page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLScriptElement>("script:not([src])")].find((s) =>
        s.textContent?.includes("crb-theme"),
      )?.nonce,
  );
  expect(themeScriptNonce).toBe(nonce);
});
