import type { Page, Locator } from "@playwright/test";

export interface AdoptionFormData {
  applicantName: string;
  email: string;
  phone: string;
  address: string;
}

/**
 * The public adoption journey: a pet profile and the application dialog it opens.
 *
 * Locators are role- and label-based throughout. The pages under test are
 * restyled often — the design-system work runs on the same branch — so anything
 * anchored to a class name would break on a change that no user could notice.
 */
export class AdoptionPage {
  constructor(private readonly page: Page) {}

  /** Opens a specific animal's profile directly. */
  async gotoPet(petId: string): Promise<void> {
    await this.page.goto(`/pets/${petId}`);
    await this.page.getByRole("tablist", { name: /pet profile tabs/i }).waitFor();
  }

  /** Opens the public catalogue. */
  async gotoCatalogue(): Promise<void> {
    await this.page.goto("/pets");
    await this.page.getByRole("heading", { name: /adoptable animals/i }).first().waitFor();
  }

  searchBox(): Locator {
    return this.page.getByPlaceholder(/search by name, breed/i);
  }

  /** Narrows the catalogue by free text and waits for the grid to settle. */
  async search(term: string): Promise<void> {
    await this.searchBox().fill(term);
  }

  heading(): Locator {
    return this.page.getByRole("heading", { level: 1 });
  }

  tab(name: RegExp): Locator {
    return this.page.getByRole("tab", { name });
  }

  /** Opens the adoption application dialog from a pet profile. */
  async openApplication(): Promise<void> {
    await this.page.getByRole("button", { name: /apply to adopt/i }).first().click();
    await this.page.getByRole("dialog").waitFor();
  }

  dialog(): Locator {
    return this.page.getByRole("dialog");
  }

  async fillApplication(data: AdoptionFormData): Promise<void> {
    const dialog = this.dialog();
    await dialog.getByLabel(/full name/i).fill(data.applicantName);
    await dialog.getByLabel(/email address/i).fill(data.email);
    await dialog.getByLabel(/contact phone number/i).fill(data.phone);
    await dialog.getByLabel(/residential address/i).fill(data.address);
  }

  async submitApplication(): Promise<void> {
    await this.dialog().getByRole("button", { name: /submit/i }).click();
  }

  /** The post-submission confirmation panel. */
  confirmation(): Locator {
    return this.page.getByText(/application submitted/i);
  }

  /** The sponsorship deep link on the support tab. */
  sponsorLink(petName: string): Locator {
    return this.page.getByRole("link", { name: new RegExp(`sponsor ${petName} today`, "i") });
  }
}
