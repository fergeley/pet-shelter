import type { Page, Locator } from "@playwright/test";

export interface DonorDetails {
  name: string;
  email: string;
  phone?: string;
  taxIdOrIc?: string;
}

/**
 * The sponsorship pledge journey on `/donate`, through to the LHDN e-receipt.
 */
export class DonatePage {
  constructor(private readonly page: Page) {}

  /** Opens the page, optionally as a deep link from a pet profile. */
  async goto(query = ""): Promise<void> {
    await this.page.goto(`/donate${query ? `?${query}` : ""}`);
    await this.carousel().waitFor();
  }

  carousel(): Locator {
    return this.page.getByRole("region", { name: /pet selection carousel/i });
  }

  /** Dedicates the pledge to one animal via the carousel. */
  async dedicateTo(petName: string): Promise<void> {
    await this.carousel().getByRole("button", { name: new RegExp(petName, "i") }).first().click();
  }

  async chooseGeneralFund(): Promise<void> {
    await this.carousel().getByRole("button", { name: /general sanctuary fund/i }).click();
  }

  async chooseFrequency(frequency: "one_time" | "monthly"): Promise<void> {
    const name = frequency === "monthly" ? /monthly rescue hero/i : /one-time gift/i;
    await this.page.getByRole("button", { name }).click();
  }

  /**
   * Selects a sponsorship tier by its catalogue name.
   *
   * By name rather than by amount: each tier card renders its price, its badge
   * and its impact copy inside one button, so a "RM 120" filter also matches any
   * card whose description happens to mention that figure.
   */
  async chooseTier(tierName: RegExp): Promise<void> {
    await this.page.getByRole("button").filter({ hasText: tierName }).first().click();
  }

  async fillDonor(details: DonorDetails): Promise<void> {
    await this.page.getByLabel(/full name/i).first().fill(details.name);
    await this.page.getByLabel(/email/i).first().fill(details.email);
    if (details.phone) await this.page.getByPlaceholder("012-345 6789").fill(details.phone);
    if (details.taxIdOrIc) {
      await this.page.getByPlaceholder(/920512-10-5432/).fill(details.taxIdOrIc);
    }
  }

  /** The running total the widget shows beside the tier grid. */
  selectedAmount(): Locator {
    return this.page.getByText(/^RM \d+\.00/).first();
  }

  async submitPledge(): Promise<void> {
    await this.page
      .getByRole("button", { name: /confirm|pledge|sponsor now|complete/i })
      .first()
      .click();
  }

  /** The issued receipt, identified by its statutory tax reference. */
  receipt(): Locator {
    return this.page.getByText(/official receipt|e-receipt|resit/i).first();
  }

  taxReference(): Locator {
    return this.page.getByText(/LHDN\.\d|44\(6\)/i).first();
  }
}
