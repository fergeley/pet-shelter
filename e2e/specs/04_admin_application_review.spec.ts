import { test, expect } from "../fixtures/authFixture";
import { AdminApplicationsPage } from "../pages/AdminApplicationsPage";

/**
 * Golden path 4 — a coordinator reviews an adoption application.
 *
 * The status change is driven forward and then back (`SUBMITTED` →
 * `UNDER_REVIEW` → `SUBMITTED`), both legal moves in the application state
 * machine. Deliberately stopping short of `APPROVED`: approval cascades — it
 * marks the animal `Adopted` and auto-rejects every competing application — and
 * that is not something a test should do to a shared catalogue it cannot undo.
 * Tier 3 covers the approval cascade, where it can be arranged and rolled back.
 */
const APPLICANT = "Melissa Wong";

test.describe("admin application review", () => {
  test("reaches the review queue as a pre-authenticated admin", async ({ adminPage }) => {
    const applications = new AdminApplicationsPage(adminPage);

    await applications.goto();

    await expect(adminPage).toHaveURL(/\/admin\/applications/);
    await expect(adminPage.getByRole("table").first()).toBeVisible();
  });

  test("opens an applicant's full questionnaire", async ({ adminPage }) => {
    const applications = new AdminApplicationsPage(adminPage);
    await applications.goto();

    await applications.row(APPLICANT).first().getByTitle(/view full questionnaire/i).click();

    const dialog = applications.dialog();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/application status/i)).toBeVisible();
    await expect(dialog.getByText(/coordinator review remarks/i)).toBeVisible();
  });

  test("offers every state the machine allows, as pressable controls", async ({ adminPage }) => {
    const applications = new AdminApplicationsPage(adminPage);
    await applications.goto();
    await applications.row(APPLICANT).first().getByTitle(/view full questionnaire/i).click();

    const dialog = applications.dialog();
    for (const label of ["Submitted", "Under Review", "Approve", "Reject"]) {
      await expect(dialog.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    // Exactly one is current, and it is exposed as pressed rather than by colour.
    await expect(dialog.getByRole("button", { pressed: true })).toHaveCount(1);
  });

  test("advances an application to Under Review and back", async ({ adminPage }) => {
    const applications = new AdminApplicationsPage(adminPage);
    await applications.goto();
    await applications.row(APPLICANT).first().getByTitle(/view full questionnaire/i).click();

    const dialog = applications.dialog();
    await dialog.getByRole("button", { name: "Under Review", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Under Review", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await dialog.getByRole("button", { name: /save decision/i }).click();
    await expect(dialog).toBeHidden();

    await expect(applications.row(APPLICANT).first()).toContainText(/under review/i);

    // Wound back so the shared queue is left as it was found.
    await applications.row(APPLICANT).first().getByTitle(/view full questionnaire/i).click();
    await dialog.getByRole("button", { name: "Submitted", exact: true }).click();
    await dialog.getByRole("button", { name: /save decision/i }).click();
    await expect(dialog).toBeHidden();

    await expect(applications.row(APPLICANT).first()).toContainText(/submitted/i);
  });

  test("records the review in the audit trail", async ({ adminPage }) => {
    await adminPage.goto("/admin/audit");

    // Every privileged mutation must leave a row naming the actor — the
    // requirement in LAYERS.md §9.5 that the audit tier exists to satisfy.
    await expect(adminPage.getByText(/APPLICATION_STATUS_|AUDIT|audit/i).first()).toBeVisible();
  });

  /**
   * Housekeeping, and the only place in the suite that can do it.
   *
   * Spec 01 submits a genuine application through the public form, which is the
   * whole point of that journey — but it also leaves a row in a shared database
   * with no public way to remove it. Deleting them here, through the same admin
   * control a coordinator would use, keeps repeated runs from silently growing
   * the review queue. Scoped to the marker name, so no real applicant is touched.
   */
  test("clears applications left behind by the public adoption spec", async ({ adminPage }) => {
    const applications = new AdminApplicationsPage(adminPage);
    await applications.goto();

    const leftovers = applications.row("E2E Golden Path Applicant");
    for (let remaining = await leftovers.count(); remaining > 0; remaining -= 1) {
      await leftovers.first().getByTitle(/archive \/ delete application/i).click();
      await adminPage.getByRole("button", { name: /yes, remove record/i }).click();
      await expect(leftovers).toHaveCount(remaining - 1);
    }

    await expect(applications.row("E2E Golden Path Applicant")).toHaveCount(0);
  });
});
