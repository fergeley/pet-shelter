import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import { Hero } from "@/components/layout/Hero";
import { selectHomeMetrics } from "@/lib/domain/metrics";
import { renderWithLanguage } from "./support/render";

/**
 * Tier 4: what the home page's impact grid actually renders.
 *
 * The selection logic itself is covered in the node tier
 * (`tests/unit/components/home.test.tsx`); this file exists for the half that
 * only jsdom can catch — a dropped prop, a missing card, an English label on
 * the Malay site, a figure no screen reader is given.
 */

/** One published override, so a test states only the figure it is about. */
function liveMetrics(key: string, metricValue: string) {
  return selectHomeMetrics([
    {
      id: `stat-${key}`,
      key,
      metricValue,
      label: "Live label",
      labelMs: "Label langsung",
      period: "To date",
      periodMs: "Sehingga kini",
      displayOrder: 10,
      isPublished: true,
    },
  ]);
}

function card(key: string): HTMLElement {
  return screen.getByTestId(`impact-stat-${key}`);
}

/**
 * The figure as an assistive technology receives it.
 *
 * Read from the sr-only node rather than the visible digits, which climb after
 * hydration. Asserting on the visible text would make every expectation a race.
 */
function statValue(key: string): string {
  const settled = card(key).querySelector<HTMLElement>("span.sr-only");
  if (!settled) throw new Error(`no screen-reader figure rendered for ${key}`);
  return settled.textContent!.trim();
}

/** What a sighted reader sees right now, mid-climb or settled. */
function visibleValue(key: string): string {
  const shown = card(key).querySelector<HTMLElement>("span[aria-hidden='true']");
  if (!shown) throw new Error(`no visible figure rendered for ${key}`);
  return shown.textContent!.trim();
}

describe("Hero impact metrics", () => {
  it("renders all five counters with the curated figures when given no metrics", () => {
    renderWithLanguage(<Hero />);

    expect(screen.getAllByTestId(/^impact-stat-/)).toHaveLength(5);
    expect(statValue("home_animals_neutered")).toBe("520+");
    expect(statValue("home_animals_rehabilitated")).toBe("380+");
    expect(statValue("home_animals_adopted")).toBe("290+");
    expect(statValue("home_active_volunteers")).toBe("150+");
    expect(statValue("home_collaborations")).toBe("25+");
    expect(screen.getByText("Neutered via TNRM")).toBeInTheDocument();
  });

  it("renders the live figure when the server supplies one", () => {
    renderWithLanguage(
      <Hero metrics={liveMetrics("home_animals_neutered", "640+")} />
    );

    expect(statValue("home_animals_neutered")).toBe("640+");
    // Unoverridden slots still show their curated figure rather than disappearing.
    expect(statValue("home_animals_rehabilitated")).toBe("380+");
    expect(statValue("home_animals_neutered")).not.toBe("520+");
  });

  it("falls back to the curated grid when handed an empty array", () => {
    renderWithLanguage(<Hero metrics={[]} />);

    expect(statValue("home_animals_neutered")).toBe("520+");
    expect(screen.getAllByTestId(/^impact-stat-/)).toHaveLength(5);
  });

  it("keeps a non-numeric figure verbatim rather than animating it to nothing", async () => {
    // `ImpactStat.metricValue` is free-form. The count-up must leave anything
    // without digits alone instead of rendering an empty or NaN counter.
    renderWithLanguage(<Hero metrics={liveMetrics("home_collaborations", "Ongoing")} />);

    expect(statValue("home_collaborations")).toBe("Ongoing");
    await waitFor(() => expect(visibleValue("home_collaborations")).toBe("Ongoing"));
  });

  it("preserves a percentage suffix while the digits climb", async () => {
    renderWithLanguage(<Hero metrics={liveMetrics("home_animals_adopted", "100%")} />);

    expect(statValue("home_animals_adopted")).toBe("100%");
    await waitFor(() => expect(visibleValue("home_animals_adopted")).toBe("100%"), {
      timeout: 3000,
    });
  });

  it("settles a grouped figure back on the published string", async () => {
    // Which intermediate frames are legal is settled deterministically in the
    // node tier against `splitFigure`/`formatFigureFrame`; sampling frames here
    // could only ever catch one of them and call it proof. What this tier owns
    // is that the climb ends on the real figure rather than near it.
    renderWithLanguage(<Hero metrics={liveMetrics("home_animals_neutered", "1,250")} />);

    expect(statValue("home_animals_neutered")).toBe("1,250");
    await waitFor(
      () => expect(visibleValue("home_animals_neutered")).toBe("1,250"),
      { timeout: 3000 }
    );
  });

  it("renders Malay labels on the Malay site", () => {
    renderWithLanguage(<Hero />, { language: "ms" });

    expect(screen.getByText("Dimandulkan (TNRM)")).toBeInTheDocument();
    expect(screen.getByText("Sukarelawan Aktif")).toBeInTheDocument();
    expect(screen.queryByText("Neutered via TNRM")).not.toBeInTheDocument();
  });
});

describe("Hero impact metrics — accessibility", () => {
  it("gives assistive tech the settled figure and hides the climbing digits", () => {
    // Regression: the figure previously carried an `aria-label` on a bare span.
    // A span maps to role=generic, which prohibits naming, so the label was
    // dropped and the only other copy was aria-hidden — announcing no number.
    renderWithLanguage(<Hero />);

    for (const key of [
      "home_animals_neutered",
      "home_animals_rehabilitated",
      "home_animals_adopted",
      "home_active_volunteers",
      "home_collaborations",
    ]) {
      const settled = card(key).querySelector("span.sr-only");
      expect(settled).not.toBeNull();
      expect(settled!.textContent!.trim().length).toBeGreaterThan(0);
      expect(settled!.getAttribute("aria-hidden")).toBeNull();
      expect(card(key).querySelector("span[aria-hidden='true']")).not.toBeNull();
    }
  });
});

describe("Hero action triggers", () => {
  it("routes to the three destinations the sitemap requires", () => {
    renderWithLanguage(<Hero />);

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(hrefs).toContain("/pets");
    expect(hrefs).toContain("/donate");
    expect(hrefs).toContain("/get-involved");
  });

  it("labels the action triggers in Malay on the Malay site", () => {
    renderWithLanguage(<Hero />, { language: "ms" });

    expect(screen.getByRole("link", { name: /Lihat Haiwan Reskue/i })).toHaveAttribute(
      "href",
      "/pets"
    );
    expect(screen.getByRole("link", { name: /Sumbang & Taja/i })).toHaveAttribute(
      "href",
      "/donate"
    );
    expect(screen.getByRole("link", { name: /Jadi Sukarelawan/i })).toHaveAttribute(
      "href",
      "/get-involved"
    );
  });
});
