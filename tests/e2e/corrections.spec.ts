import { expect, test } from "@playwright/test";

import { storageFor } from "./helpers";

test.describe("therapists adding patients", () => {
  test.skip(({ isMobile }) => isMobile, "Writes to the shared database");
  test.use({ storageState: storageFor("therapist") });

  test("a therapist adds a patient, assigned to them, and edits their details", async ({
    page,
  }) => {
    const last = `Garcia${Date.now() % 100000}`;
    await page.goto("/patients");
    await page.getByRole("button", { name: "Add patient" }).click();
    const form = page.getByRole("dialog", { name: "Add patient" });
    await expect(form.getByText(/assigned to you as their primary therapist/)).toBeVisible();
    await expect(form.getByText("Primary therapist", { exact: true })).toHaveCount(0);
    await form.getByLabel("First name").fill("Noel");
    await form.getByLabel("Last name").fill(last);
    await form.getByRole("button", { name: "Add patient" }).click();
    await expect(page.getByText(`Noel ${last} added to patients`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: `Noel ${last}` })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Credit/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Edit details" }).click();
    const edit = page.getByRole("dialog", { name: "Edit patient" });
    await expect(edit.getByText("The front desk sets who treats this patient.")).toBeVisible();
    await edit.getByLabel("Diagnosis").fill("Fine motor delay");
    await edit.getByRole("button", { name: "Save patient" }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByText("Fine motor delay")).toBeVisible();
  });
});

test.describe("correcting payments", () => {
  test.skip(({ isMobile }) => isMobile, "Writes to the shared database");
  test.use({ storageState: storageFor("secretary") });

  test("edit a payment's method, then void another", async ({ page }) => {
    await page.goto("/billing");
    await page.getByRole("button", { name: "Payment actions for Sofia Reyes" }).click();
    await page.getByRole("menuitem", { name: "Edit payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit payment" });
    await expect(dialog.getByText(/Replacing receipt CRB-1098/)).toBeVisible();
    await dialog.getByRole("radio", { name: "GCash" }).click();
    await dialog.getByLabel("Reference number").fill("0029 7777");
    const save = dialog.getByRole("button", { name: "Save corrected payment" });
    await expect(save).toBeDisabled();
    await dialog.getByLabel("Reason for the change").fill("Paid by GCash, not cash");
    await save.click();
    await expect(page.getByText("Payment corrected for Sofia Reyes")).toBeVisible();
    await expect(page.getByRole("row", { name: /Sofia Reyes.*GCash.*Paid/ })).toBeVisible();

    await page.getByRole("button", { name: "Payment actions for Amara Cruz" }).click();
    await page.getByRole("menuitem", { name: "Void payment" }).click();
    const voiding = page.getByRole("dialog", { name: "Void Amara Cruz's payment?" });
    await voiding.getByLabel("Reason").fill("Recorded on the wrong session");
    await voiding.getByRole("button", { name: "Void payment" }).click();
    await expect(page.getByText("Receipt CRB-1099 voided")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Collect payment from Amara Cruz" }),
    ).toBeVisible();
  });
});

test.describe("correcting credit", () => {
  test.skip(({ isMobile }) => isMobile, "Writes to the shared database");

  test("adjust a balance by hand, then void the adjustment", async ({ page }) => {
    await page.goto("/patients?patient=pat_14&tab=credit");
    await page.getByRole("button", { name: "Adjust balance" }).click();
    const dialog = page.getByRole("dialog", { name: /Adjust Iggy Navarro/ });
    await dialog.getByLabel("Amount").fill("500");
    await dialog.getByLabel("Reason").fill("Goodwill credit");
    await dialog.getByRole("button", { name: "Add credit" }).click();
    await expect(page.getByText("Iggy Navarro's credit adjusted")).toBeVisible();
    await expect(page.getByText("Credit added")).toBeVisible();

    await page.getByRole("button", { name: /Actions for Credit added/ }).click();
    await page.getByRole("menuitem", { name: "Void" }).click();
    const voiding = page.getByRole("dialog", { name: /Void this ₱500 entry/ });
    await voiding.getByLabel("Reason").fill("Added to the wrong patient");
    await voiding.getByRole("button", { name: "Void entry" }).click();
    await expect(page.getByText("Entry voided")).toBeVisible();
    await expect(page.getByText("Voided", { exact: true })).toBeVisible();
    await expect(page.getByText(/Added to the wrong patient/)).toBeVisible();
  });
});
