import type { Page, Locator } from "@playwright/test";

/** Admin animal management at `/admin/pets`. Requires a signed-in page. */
export class AdminPetsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/admin/pets");
    // The gate is client-side, so wait for content rather than for navigation:
    // the URL is correct long before the session has resolved.
    await this.filterBox().waitFor({ timeout: 30_000 });
  }

  filterBox(): Locator {
    return this.page.getByPlaceholder(/filter by name or breed/i);
  }

  async filter(term: string): Promise<void> {
    await this.filterBox().fill(term);
  }

  /** The table row for one animal, located by its visible name. */
  row(petName: string): Locator {
    return this.page.getByRole("row").filter({ hasText: petName });
  }

  /**
   * Scopes the table to active, archived, or all records.
   *
   * The default is `active`, so an animal disappears from the table the moment
   * it is archived — which is correct for daily use and means a lifecycle spec
   * has to widen the scope before it can find the restore control.
   */
  async showRecords(scope: "active" | "archived" | "all"): Promise<void> {
    await this.page.getByLabel(/archive:/i).selectOption(scope);
  }

  /**
   * Leaves `petName` un-archived, whatever state it was in.
   *
   * These specs run against a shared development database, so they cannot
   * assume a clean catalogue: an earlier interrupted run may have left an
   * animal archived. Normalising first makes the lifecycle test idempotent and
   * self-repairing rather than order-dependent.
   */
  async ensureActive(petName: string): Promise<void> {
    await this.showRecords("all");
    await this.filter(petName);

    const restore = this.row(petName).first().getByTitle(/restore pet profile/i);
    if (await restore.count()) {
      await this.setArchived(petName, false);
    }
    await this.showRecords("active");
  }

  /**
   * Archives or restores an animal, including the confirmation step.
   *
   * Both actions open a confirm dialog rather than mutating on click — soft
   * deletion is destructive from a visitor's point of view, so the table asks
   * first. A spec that only clicked the row button would assert against a
   * catalogue that never changed.
   */
  async setArchived(petName: string, archived: boolean): Promise<void> {
    const trigger = archived ? /archive pet/i : /restore pet profile/i;
    const confirm = archived ? /yes, archive record/i : /yes, restore record/i;

    await this.row(petName).first().getByTitle(trigger).click();
    await this.page.getByRole("button", { name: confirm }).click();
    await this.page.getByRole("button", { name: confirm }).waitFor({ state: "hidden" });
  }

  async openNewPetForm(): Promise<void> {
    await this.page.getByRole("button", { name: /add|new animal|new pet/i }).first().click();
    await this.page.getByRole("dialog").waitFor();
  }

  dialog(): Locator {
    return this.page.getByRole("dialog");
  }
}
