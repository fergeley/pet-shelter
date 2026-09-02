import type { Page, Locator } from "@playwright/test";

/** Admin application review at `/admin/applications`. Requires a signed-in page. */
export class AdminApplicationsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/admin/applications");
    await this.page.getByRole("table").first().waitFor({ timeout: 30_000 });
  }

  row(applicantName: string): Locator {
    return this.page.getByRole("row").filter({ hasText: applicantName });
  }

  async open(applicantName: string): Promise<void> {
    await this.row(applicantName).first().click();
    await this.page.getByRole("dialog").waitFor();
  }

  dialog(): Locator {
    return this.page.getByRole("dialog");
  }
}
