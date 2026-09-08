import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";

import { Hero } from "@/components/layout/Hero";
import { selectHomeMetrics } from "@/lib/domain/metrics";
import { renderWithLanguage } from "./support/render";

/**
 * Tier 4: what the home page's impact grid actually renders.
 *
 * The selection logic itself is covered in the node tier
 * (`tests/unit/components/home.test.tsx`); this file exists for the half that
 * only jsdom can catch — a dropped prop, a missing card, an English label on
 * the Malay site.
 */

function statValue(key: string): string {
  return within(screen.getByTestId(`impact-stat-${key}`))
    .getByText(/\S/, { selector: "span" })
    .textContent!.trim();
}

describe("Hero impact metrics", () => {
  it("renders all five counters with the curated figures when given no metrics", () => {
    renderWithLanguage(<Hero />);

    expect(screen.getByText("520+")).toBeInTheDocument();
    expect(screen.getByText("380+")).toBeInTheDocument();
    expect(screen.getByText("290+")).toBeInTheDocument();
    expect(screen.getByText("150+")).toBeInTheDocument();
    expect(screen.getByText("25+")).toBeInTheDocument();
    expect(screen.getByText("Neutered via TNRM")).toBeInTheDocument();
  });

  it("renders the live figure when the server supplies one", () => {
    const metrics = selectHomeMetrics([
      {
        id: "s1",
        key: "home_animals_neutered",
        metricValue: "640+",
        label: "Neutered via TNRM",
        labelMs: "Dimandulkan (TNRM)",
        period: "To date",
        periodMs: "Sehingga kini",
        displayOrder: 10,
        isPublished: true,
      },
    ]);

    renderWithLanguage(<Hero metrics={metrics} />);

    expect(statValue("home_animals_neutered")).toBe("640+");
    // Unoverridden slots still show their curated figure rather than disappearing.
    expect(statValue("home_animals_rehabilitated")).toBe("380+");
    expect(screen.queryByText("520+")).not.toBeInTheDocument();
  });

  it("falls back to the curated grid when handed an empty array", () => {
    renderWithLanguage(<Hero metrics={[]} />);

    expect(statValue("home_animals_neutered")).toBe("520+");
    expect(screen.getAllByTestId(/^impact-stat-/)).toHaveLength(5);
  });

  it("renders Malay labels on the Malay site", () => {
    renderWithLanguage(<Hero />, { language: "ms" });

    expect(screen.getByText("Dimandulkan (TNRM)")).toBeInTheDocument();
    expect(screen.getByText("Sukarelawan Aktif")).toBeInTheDocument();
    expect(screen.queryByText("Neutered via TNRM")).not.toBeInTheDocument();
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
