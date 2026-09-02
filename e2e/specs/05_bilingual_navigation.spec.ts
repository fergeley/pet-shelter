import { test, expect, type Page } from "@playwright/test";

/**
 * Golden path 5 — the bilingual switcher.
 *
 * Both languages are a product requirement for a Malaysian shelter, not a
 * nicety. Tier 2 checks dictionary key parity; only a browser shows that
 * flipping the control re-renders the page and that the choice survives a
 * navigation.
 */
const toggle = (page: Page) => page.getByRole("group", { name: /language selector/i }).first();

test.describe("bilingual switching", () => {
  test("starts in English with both languages offered", async ({ page }) => {
    await page.goto("/pets");

    await expect(toggle(page)).toBeVisible();
    await expect(toggle(page).getByRole("button", { name: "EN" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(toggle(page).getByRole("button", { name: "BM" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  test("re-renders the catalogue in Bahasa Malaysia", async ({ page }) => {
    await page.goto("/pets");
    // Level 2: the catalogue's own title is the gallery heading, and `/pets`
    // has no `h1` at all — the animal name is the `h1`, and only on a profile.
    const galleryHeading = page.getByRole("heading", { level: 2 }).first();
    const englishHeading = await galleryHeading.textContent();

    await toggle(page).getByRole("button", { name: "BM" }).click();

    await expect(toggle(page).getByRole("button", { name: "BM" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    // Compared against the English text captured a moment ago rather than a
    // hardcoded Malay string, so the assertion survives a translator improving
    // the copy while still proving the switch re-rendered the page.
    await expect(galleryHeading).not.toHaveText(englishHeading ?? "__unset__");
  });

  test("remembers the choice across a navigation", async ({ page }) => {
    await page.goto("/pets");
    await toggle(page).getByRole("button", { name: "BM" }).click();
    await expect(toggle(page).getByRole("button", { name: "BM" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.goto("/donate");

    // Persisted to localStorage and a cookie, so a reader who switches once is
    // not silently switched back by following a link.
    await expect(toggle(page).getByRole("button", { name: "BM" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("sets the document language for assistive technology", async ({ page }) => {
    await page.goto("/pets");

    await toggle(page).getByRole("button", { name: "BM" }).click();

    // Without this a screen reader keeps reading Malay copy with English
    // pronunciation rules — the switch would be visual only.
    await expect(page.locator("html")).toHaveAttribute("lang", "ms");
  });
});
