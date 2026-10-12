import { expect, type Page, test } from "@playwright/test";

import { storageFor } from "./helpers";

const SCREENS = {
  superadmin: [
    ["/dashboard", "Good morning, Camelia"],
    ["/schedule", "Schedule"],
    ["/patients", "Patients"],
    ["/billing", "Billing and payments"],
    ["/payroll", "Payroll"],
    ["/settings", "Settings"],
  ],
  secretary: [
    ["/today", "Good morning, Jo"],
    ["/schedule", "Schedule"],
    ["/patients", "Patients"],
    ["/billing", "Billing and payments"],
  ],
  therapist: [
    ["/my-day", "Good morning, Jolyn"],
    ["/schedule", "My schedule"],
    ["/patients", "Patients"],
  ],
} as const;

for (const [role, screens] of Object.entries(SCREENS)) {
  test.describe(`every screen for ${role}`, () => {
    test.use({ storageState: storageFor(role as keyof typeof SCREENS) });

    test(`${role} screens render without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));

      for (const [path, heading] of screens) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeAttached();
      }
      expect(errors).toEqual([]);
    });
  });
}

// The flows below change in-memory demo state, so each test starts on a fresh page.
test.describe("front desk flows", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop layout");
  test.use({ storageState: storageFor("secretary") });

  const pickPatient = async (page: Page, name: string) => {
    await page.getByLabel("Patient").click();
    await page.getByPlaceholder("Type a name").fill(name);
    // Anchored, so "Add new patient <name>" is not matched.
    await page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
  };
  const pickSelect = async (page: Page, label: string, option: string | RegExp) => {
    await page.getByLabel(label).click();
    await page.getByRole("option", { name: option }).click();
  };

  test("book a one-off session", async ({ page }) => {
    await page.goto("/schedule");
    await page.getByRole("button", { name: "New session" }).click();
    const dialog = page.getByRole("dialog", { name: "New session" });
    await pickPatient(page, "Franco Lee");
    await pickSelect(page, "Therapist", /Marco Tan/);
    await pickSelect(page, "Time", "4:00 PM");
    await dialog.getByRole("button", { name: "Book session" }).click();

    await expect(page.getByText("Session booked for Franco Lee")).toBeVisible();
    await page.getByRole("button", { name: "Next day" }).click();
    await expect(page.getByRole("heading", { name: "Mon, Aug 24, 2026" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Franco Lee/ })).toBeVisible();
  });

  test("double booking is rejected with a clear message", async ({ page }) => {
    await page.goto("/schedule");
    // Tan is free at 9:00 today, but Liam Santos is already with Dela Rosa.
    // Clicking the empty slot pre-fills Tan, today and 9:00.
    await page.getByRole("button", { name: "Book Tan at 9:00 AM" }).click();
    const dialog = page.getByRole("dialog", { name: "New session" });
    await expect(dialog.getByRole("button", { name: "Date" })).toHaveText(/Sat, Aug 22/);
    await pickPatient(page, "Liam Santos");
    await dialog.getByRole("button", { name: "Book session" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Liam Santos already has a session at 9:00 AM",
    );
  });

  test("check in from the Today queue updates the schedule", async ({ page }) => {
    await page.goto("/today");
    await page.getByRole("button", { name: "Check in Franco Lee" }).click();
    await expect(page.getByText("Franco Lee checked in")).toBeVisible();

    await page.getByRole("link", { name: "Schedule" }).click();
    await expect(page.getByRole("button", { name: /Franco Lee.*Checked in/ })).toBeVisible();
  });

  test("mark attended from the session dialog", async ({ page }) => {
    await page.goto("/schedule");
    await page.getByRole("button", { name: /Gab Torres/ }).click();
    await page.getByRole("button", { name: "Mark attended" }).click();
    await expect(page.getByText("Gab Torres: attended")).toBeVisible();
    await expect(page.getByRole("button", { name: /Gab Torres.*Attended/ })).toBeVisible();
  });

  test("cancelling a recurring session asks how far", async ({ page }) => {
    await page.goto("/schedule");
    await page.getByRole("button", { name: /Iggy Navarro/ }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("Cancel a recurring session")).toBeVisible();
    await page.getByRole("button", { name: /This and all future sessions/ }).click();
    await expect(page.getByText("Iggy Navarro: weekly booking ended")).toBeVisible();

    // Next Saturday's session in the same series is cancelled too.
    await page.getByRole("radio", { name: "Week" }).click();
    await page.getByRole("button", { name: "Next week" }).click();
    await page.getByRole("button", { name: /Open Saturday, Aug 29/ }).click();
    await expect(page.getByRole("button", { name: /Iggy Navarro.*Cancelled/ })).toBeVisible();
  });

  test("reschedule into a make-up session", async ({ page }) => {
    await page.goto("/schedule");
    await page.getByRole("button", { name: /Caleb Uy/ }).click();
    await page.getByRole("button", { name: "Reschedule" }).click();
    const dialog = page.getByRole("dialog", { name: "Reschedule session" });
    await expect(dialog.getByText("Moving")).toBeVisible();
    await pickSelect(page, "Time", "3:00 PM");
    await dialog.getByRole("button", { name: "Confirm reschedule" }).click();

    await expect(page.getByText("Caleb Uy moved")).toBeVisible();
    await expect(page.getByRole("button", { name: /Caleb Uy.*Rescheduled/ })).toBeVisible();
  });

  test("collect a payment with advance credit", async ({ page }) => {
    await page.goto("/billing");
    await page.getByRole("button", { name: "Collect payment from Enzo Dela Peña" }).click();
    const dialog = page.getByRole("dialog", { name: "Collect payment" });
    await expect(dialog.getByText("Credit covers this session in full")).toBeVisible();
    await dialog.getByRole("button", { name: "Pay ₱700 from credit" }).click();

    await expect(page.getByText("Payment recorded for Enzo Dela Peña")).toBeVisible();
    const row = page.getByRole("row", { name: /Enzo Dela Peña/ });
    await expect(row.getByText("Paid")).toBeVisible();
    await expect(row.getByText("Credit ₱4,200")).toBeVisible();
    // Stored in the database: it survives a reload.
    await page.reload();
    await expect(page.getByRole("row", { name: /Enzo Dela Peña.*Credit ₱700 Paid/ })).toBeVisible();
  });

  test("cash must cover the fee and shows change", async ({ page }) => {
    await page.goto("/billing");
    await page.getByRole("button", { name: "Collect payment from Gab Torres" }).click();
    const dialog = page.getByRole("dialog", { name: "Collect payment" });
    const confirm = dialog.getByRole("button", { name: "Confirm ₱700" });

    await dialog.getByLabel("Cash received").fill("500");
    await expect(dialog.getByText("Short by")).toBeVisible();
    await expect(confirm).toBeDisabled();

    await dialog.getByRole("button", { name: "₱1,000" }).click();
    await expect(dialog.getByText("Change")).toBeVisible();
    await expect(dialog.getByText("₱300")).toBeVisible();
    await confirm.click();
    await expect(page.getByText("Payment recorded for Gab Torres")).toBeVisible();
  });

  test("record an advance payment; non-cash needs a reference", async ({ page }) => {
    await page.goto("/billing");
    await page.getByRole("button", { name: "Record advance payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Record advance payment" });
    await pickPatient(page, "Amara Cruz");
    await dialog.getByRole("button", { name: /₱3,500/ }).click();
    await dialog.getByRole("radio", { name: "GCash" }).click();

    const record = dialog.getByRole("button", { name: "Record ₱3,500" });
    await expect(record).toBeDisabled();
    await dialog.getByLabel("Reference no.").fill("0031 9981 004");
    await record.click();
    await expect(page.getByText("Advance recorded for Amara Cruz")).toBeVisible();
    await expect(page.getByText("4 patients with credit")).toBeVisible();
  });
});

test.describe("owner settings", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop layout");

  test("inactive patients cannot be booked", async ({ page }) => {
    await page.goto("/settings?tab=patients");
    await page.getByRole("switch", { name: "Hana Sy active" }).click();
    // Navigate inside the app: a full reload would reset the in-memory demo state.
    await page.getByRole("link", { name: "Schedule" }).click();
    await page.getByRole("button", { name: "New session" }).click();
    await page.getByLabel("Patient").click();
    await page.getByPlaceholder("Type a name").fill("Hana");
    await expect(page.getByRole("option", { name: /^Hana Sy/ })).toHaveCount(0);
    await expect(page.getByRole("option", { name: /^Add new patient/ })).toBeVisible();
  });
});

test.describe("patients", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop layout");

  test("search, filter, keyboard open and empty state", async ({ page }) => {
    await page.goto("/patients");
    await page.getByRole("radio", { name: "SPED" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(3);

    await page.getByRole("row", { name: /Jaz Ocampo/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/patient=pat_15/);
    await expect(page.getByRole("heading", { level: 2, name: "Jaz Ocampo" })).toBeVisible();

    await page.getByLabel("Search by patient or guardian").fill("nobody here");
    await expect(page.getByText("No patients match these filters")).toBeVisible();
  });

  test("credit tab shows the ledger with a running balance", async ({ page }) => {
    await page.goto("/patients?patient=pat_01&tab=credit");
    await expect(page.getByText("₱4,200").first()).toBeVisible();
    await expect(page.getByText("10-session OT package")).toBeVisible();
    await expect(page.getByText("Bal. ₱7,000")).toBeVisible();
  });
});

test.describe("therapist", () => {
  test.use({ storageState: storageFor("therapist") });

  test("sees every patient at the branch but no billing or credit", async ({ page }) => {
    await page.goto("/patients");
    await expect(page.getByRole("tab", { name: /Credit/ })).toHaveCount(0);
    await expect(page.getByText(/owes/)).toHaveCount(0);
    await page.goto("/patients?q=Liam");
    await expect(page.getByRole("row", { name: /Liam Santos/ })).toBeVisible();
    // Sofia Reyes is a SPED patient with no link to Dela Rosa.
    await page.goto("/patients?q=Sofia");
    await expect(page.getByRole("row", { name: /Sofia Reyes/ })).toBeVisible();

    await page.goto("/billing");
    await expect(page).toHaveURL(/\/my-day$/);
  });

  test("adds a note and clears it from notes due", async ({ page, isMobile }) => {
    // Writes to the shared e2e database, so it runs once (desktop), not per device.
    test.skip(isMobile, "Desktop only");
    await page.goto("/my-day");
    await expect(page.getByText("Due today")).toBeVisible();
    await page.getByRole("button", { name: "Add note for Liam Santos" }).click();
    const dialog = page.getByRole("dialog", { name: "Liam Santos" });
    await dialog.getByLabel("Add a session note").fill("Worked on pencil grip. Good focus today.");
    await dialog.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Session note saved")).toBeVisible();
    await expect(dialog.getByText("Worked on pencil grip. Good focus today.")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByText("Due today")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open notes for Liam Santos" })).toBeVisible();
  });
});

for (const [role, screens] of Object.entries(SCREENS)) {
  test.describe(`narrow phones, ${role}`, () => {
    test.use({
      viewport: { width: 360, height: 780 },
      storageState: storageFor(role as keyof typeof SCREENS),
    });

    test(`${role} screens never scroll sideways at 360px`, async ({ page }) => {
      for (const [path] of screens) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
        // Wide grids and tables scroll inside their own container, never the page.
        const overflow = await page.evaluate(() => {
          const main = document.getElementById("main")!;
          return {
            page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            main: main.scrollWidth - main.clientWidth,
          };
        });
        expect(overflow, path).toEqual({ page: 0, main: 0 });
      }
    });
  });
}

test.describe("patient records", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop layout");

  test("add a patient, edit them, set them inactive and remove them", async ({ page }) => {
    await page.goto("/patients");
    await page.getByRole("button", { name: "Add patient" }).click();
    const form = page.getByRole("dialog", { name: "Add patient" });
    await form.getByLabel("First name").fill("Rina");
    await form.getByLabel("Last name").fill("Uy");
    await form.getByLabel("Diagnosis").fill("Speech sound disorder");
    await form.getByLabel("Name", { exact: true }).fill("Lea Uy");
    await form.getByLabel("Email").fill("not-an-email");
    await form.getByRole("button", { name: "Add patient" }).click();
    await expect(form.getByText("Enter a valid email address.")).toBeVisible();
    await form.getByLabel("Email").fill("lea.uy@example.test");
    await form.getByRole("button", { name: "Add patient" }).click();

    await expect(page.getByText("Rina Uy added to patients")).toBeVisible();
    const detail = page.getByRole("heading", { level: 2, name: "Rina Uy" });
    await expect(detail).toBeVisible();

    await page.getByRole("button", { name: "Patient actions" }).click();
    await page.getByRole("menuitem", { name: "Edit details" }).click();
    const edit = page.getByRole("dialog", { name: "Edit patient" });
    await edit.getByLabel("Diagnosis").fill("Receptive language delay");
    await edit.getByRole("button", { name: "Save patient" }).click();
    await expect(page.getByText("Receptive language delay")).toBeVisible();

    await page.getByRole("button", { name: "Patient actions" }).click();
    await page.getByRole("menuitem", { name: "Set inactive" }).click();
    await expect(page.getByText("Rina Uy set inactive")).toBeVisible();

    // Inactive patients are not offered when booking.
    await page.getByRole("link", { name: "Schedule" }).click();
    await page.getByRole("button", { name: "New session" }).click();
    await page.getByLabel("Patient").click();
    await page.getByPlaceholder("Type a name").fill("Rina");
    await expect(page.getByRole("option", { name: /^Add new patient/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /^Rina Uy/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.goto("/patients?q=Rina&status=all");
    await page.getByRole("button", { name: "Patient actions" }).click();
    await page.getByRole("menuitem", { name: "Remove patient" }).click();
    await page.getByRole("button", { name: "Remove patient" }).click();
    await expect(page.getByText("Rina Uy removed")).toBeVisible();
    await expect(page.getByText("No patients match these filters")).toBeVisible();
  });
});

test.describe("settings persist", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop layout");

  test("rates, session types and hours survive a reload", async ({ page }) => {
    await page.goto("/settings?tab=rates");
    const share = page.getByLabel("SPED Tutor therapist share");
    await share.fill("75");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Rates saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("SPED Tutor therapist share")).toHaveValue("75");

    await page.goto("/settings?tab=sessions");
    await page.getByRole("button", { name: "Add session type" }).click();
    await page.getByLabel("Name").fill("OT group session");
    await page.getByLabel("Rate", { exact: true }).fill("400");
    await page.getByRole("button", { name: "Add session type" }).click();
    await expect(page.getByText("OT group session added")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("OT group session rate")).toHaveValue("400");

    await page.goto("/settings?tab=hours");
    // Sunday, which no other test books, so parallel tests are unaffected.
    await page.getByRole("button", { name: "Sun", exact: true }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Operating hours saved")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Open every day.")).toBeVisible();
    await page.getByRole("button", { name: "Sun", exact: true }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Operating hours saved")).toBeVisible();
  });
});

test.describe("payroll", () => {
  test("monthly view, weekly totals from attended sessions and CSV export", async ({ page }) => {
    await page.goto("/payroll");
    await expect(page.getByText("Therapist and clinic shares for August 2026.")).toBeVisible();

    await page.getByRole("radio", { name: "Weekly" }).click();
    await expect(page.getByText("Week of Aug 17 to 23, 2026")).toBeVisible();
    await expect(page).toHaveURL(/period=weekly/);
    // A past week, so other tests marking sessions attended today can't change it.
    await page.getByRole("button", { name: "Previous period" }).click();
    await expect(page.getByText("Week of Aug 10 to 16, 2026")).toBeVisible();
    await expect(page.getByRole("row", { name: /^Total 36/ })).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("payroll-b1-2026-08-10-to-2026-08-16.csv");
  });

  test.describe("for the front desk", () => {
    test.use({ storageState: storageFor("secretary") });
    test("the CSV export is refused", async ({ request }) => {
      const response = await request.get("/api/payroll/export?period=monthly");
      expect(response.status()).toBe(403);
    });
  });
});

test.describe("owner dashboard", () => {
  test.skip(({ isMobile }) => isMobile, "Writes to the shared database");

  test("shows the month from the database and records an expense", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Income in August")).toBeVisible();
    await expect(page.getByText("Sessions this month")).toBeVisible();
    await expect(page.getByRole("link", { name: /Enzo Dela Peña.*3 this month/ })).toBeVisible();

    await page.getByRole("button", { name: "Record expense" }).click();
    const dialog = page.getByRole("dialog", { name: "Record expense" });
    await dialog.getByLabel("Category").click();
    await page.getByRole("option", { name: "Supplies" }).click();
    await dialog.getByLabel("Amount").fill("1250");
    await dialog.getByRole("button", { name: "Record ₱1,250" }).click();
    await expect(page.getByText("Expense recorded")).toBeVisible();
    await expect(dialog).toBeHidden();
  });
});

test.describe("patient data export", () => {
  test("the owner downloads one patient's data as JSON", async ({ request }) => {
    const response = await request.get("/api/patients/pat_01/export");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toContain("patient-pat_01-export.json");
    const body = await response.json();
    expect(body.patient.id).toBe("pat_01");
  });

  test.describe("for the front desk", () => {
    test.use({ storageState: storageFor("secretary") });
    test("the export is refused", async ({ request }) => {
      expect((await request.get("/api/patients/pat_01/export")).status()).toBe(403);
    });
  });
});
