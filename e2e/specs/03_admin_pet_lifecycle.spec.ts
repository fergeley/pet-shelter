import { test, expect } from "../fixtures/authFixture";
import { AdminPetsPage } from "../pages/AdminPetsPage";

/**
 * Golden path 3 — admin animal management, and the soft delete beneath it.
 *
 * Run as a round trip: archive an animal, prove the public catalogue stops
 * offering it, then restore it. That is the property worth guarding — an
 * archived animal must not be adoptable — and closing the circle is also what
 * lets this spec run against a shared development database without leaving the
 * catalogue changed.
 */
const SUBJECT = "Bella";

test.describe("admin animal lifecycle", () => {
  test.beforeEach(async ({ adminPage }) => {
    const admin = new AdminPetsPage(adminPage);
    await admin.goto();
    // Self-repairing: an interrupted earlier run may have left the animal
    // archived, and every test below starts from it being active.
    await admin.ensureActive(SUBJECT);
  });

  test("admits a pre-authenticated admin without the login form", async ({ adminPage }) => {
    const admin = new AdminPetsPage(adminPage);

    // The gate is a client component that redirects when the session has not
    // resolved, so reaching the table at all is the assertion.
    await expect(adminPage).toHaveURL(/\/admin\/pets/);
    await expect(admin.filterBox()).toBeVisible();
  });

  test("filters the roster down to one animal", async ({ adminPage }) => {
    const admin = new AdminPetsPage(adminPage);

    await admin.filter(SUBJECT);

    await expect(admin.row(SUBJECT).first()).toBeVisible();
    await expect(adminPage.getByRole("row")).toHaveCount(2); // header + one match
  });

  test("archives an animal, hides it publicly, then restores it", async ({ adminPage }) => {
    const admin = new AdminPetsPage(adminPage);
    await admin.filter(SUBJECT);

    await admin.setArchived(SUBJECT, true);

    // Half one: the row leaves the admin table's default "active" scope.
    await expect(adminPage.getByText(/no animals match/i)).toBeVisible();
    await admin.showRecords("archived");
    await expect(admin.row(SUBJECT).first().getByTitle(/restore pet profile/i)).toBeVisible();

    // Half two, and the one that matters: no visitor can apply for the animal.
    const publicPage = await adminPage.context().newPage();
    await publicPage.goto("/pets");
    await publicPage.getByPlaceholder(/search by name, breed/i).fill(SUBJECT);
    await expect(publicPage.getByRole("heading", { name: SUBJECT, exact: true })).toHaveCount(0);
    await publicPage.close();

    await admin.setArchived(SUBJECT, false);
    await admin.showRecords("active");
    await expect(admin.row(SUBJECT).first().getByTitle(/archive pet/i)).toBeVisible();
  });

  test("returns the restored animal to the public catalogue", async ({ adminPage }) => {
    // Guards the restore above: a failure here means the previous test left the
    // shared catalogue an animal short.
    await adminPage.goto("/pets");
    await adminPage.getByPlaceholder(/search by name, breed/i).fill(SUBJECT);

    await expect(adminPage.getByText(new RegExp(SUBJECT, "i")).first()).toBeVisible();
  });
});
