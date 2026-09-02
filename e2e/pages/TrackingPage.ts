import type { Page, Locator } from "@playwright/test";

/** The public application-status lookup at `/applications/track`. */
export class TrackingPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/applications/track");
    await this.page.getByRole("heading", { name: /track adoption application/i }).waitFor();
  }

  async lookup(referenceId: string, email: string): Promise<void> {
    await this.page.getByPlaceholder(/app-\d/i).fill(referenceId);
    await this.page.getByPlaceholder(/your\.email@example\.com/i).fill(email);
    await this.page.getByRole("button", { name: /track|search|look ?up/i }).first().click();
  }

  /**
   * The refusal shown for a wrong reference or email.
   *
   * Deliberately the same message for both, so the form cannot be used to
   * confirm that an application exists for an address the caller does not own.
   */
  notFoundMessage(): Locator {
    return this.page.getByText(/no application matching/i);
  }

  statusPanel(): Locator {
    return this.page.getByText(/submitted|under review|approved|rejected/i).first();
  }
}
