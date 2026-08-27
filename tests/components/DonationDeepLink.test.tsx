import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";

vi.mock("@/actions/donations", () => ({ submitDonationPledgeAction: vi.fn() }));
// The widget falls back to fetching the public catalogue when it is handed no
// pets. Every test below supplies `initialPets`, so this exists to keep an
// unexpected fetch from reaching Prisma rather than to be exercised.
vi.mock("@/actions/pets", () => ({ getPublicPets: vi.fn().mockResolvedValue([]) }));

import { DonationWidget } from "@/components/features/donations/DonationWidget";
import { setMockLocation } from "../setup/nextMocks";
import { renderWithLanguage, makePet } from "./support/render";

const bella = makePet({ id: "pet-001", name: "Bella" });
const tiger = makePet({ id: "pet-002", name: "Tiger" });

/**
 * Renders the widget as `/donate?<query>` would.
 *
 * `setMockLocation` points the harness's `useSearchParams()` at the query, which
 * is the only channel the widget reads — it takes no URL prop. The URL must be
 * set *before* render: every value below seeds a `useState` initialiser, so a
 * location changed afterwards would be ignored, exactly as it is in the browser.
 */
function renderAt(query: string, pets = [bella, tiger]) {
  setMockLocation("/donate", query);
  return renderWithLanguage(<DonationWidget initialPets={pets} />);
}

/** The "Selected: RM 50.00" summary the widget keeps beside the tier grid. */
const selectedAmount = () => screen.getByText(/^RM \d+\.00/).textContent ?? "";

/**
 * The monthly-companion card headline, which reads
 * "Rescue Companion & Updates — <animal>" once an animal is dedicated and falls
 * back to "Shelter Rescues" otherwise.
 *
 * Only rendered for monthly giving or the kibble tier, so the tests below that
 * read it pin `freq=monthly`. That is orthogonal to the id/name resolution under
 * test — it merely makes the resolved animal observable, since the carousel
 * marks its chosen card with colour and a check icon alone.
 *
 * This is the widget's only *textual* rendering of the selection. The carousel
 * itself marks the chosen card with colour and a check icon and exposes no
 * `aria-pressed` or `aria-current`, so there is no accessible selected-state to
 * assert on — see the follow-on noted in
 * docs/tasks/TARGET_TEST_TIERS_3_4_5_EXECUTION.md.
 */
const dedicatedTo = () => {
  // A function matcher, because the headline is assembled from sibling
  // expressions (`{t(...)} — {selectedPet.name}`) and Testing Library's string
  // and regex matchers only ever see one text node at a time. Narrowing to the
  // deepest matching element keeps the ancestors from also matching.
  const headline = screen.getByText((_content, element) => {
    const text = element?.textContent ?? "";
    if (!text.includes("Rescue Companion & Updates")) return false;
    return !Array.from(element?.children ?? []).some((child) =>
      child.textContent?.includes("Rescue Companion & Updates")
    );
  });
  return headline.textContent?.split("—").pop()?.trim() ?? "";
};

const carousel = () => screen.getByRole("region", { name: /pet selection carousel/i });

beforeEach(() => {
  setMockLocation("/donate", "");
});

describe("DonationWidget deep linking", () => {
  describe("defaults with no query string", () => {
    it("starts on the vaccination tier and a one-time gift", () => {
      renderAt("");

      expect(selectedAmount()).toMatch(/^RM 50\.00/);
      expect(selectedAmount()).not.toMatch(/\/ mo/);
    });

    it("dedicates nothing, leaving the general fund selected", () => {
      renderAt("");

      expect(within(carousel()).getByRole("button", { name: /general sanctuary fund/i })).toBeInTheDocument();
    });
  });

  describe("sponsorPetId", () => {
    it("preselects the named animal in the carousel", () => {
      renderAt("sponsorPetId=pet-002&freq=monthly");

      expect(dedicatedTo()).toBe("Tiger");
    });

    it("ignores an id that matches no animal rather than crashing", () => {
      renderAt("sponsorPetId=pet-does-not-exist&freq=monthly");

      expect(dedicatedTo()).toBe("Shelter Rescues");
      expect(selectedAmount()).toMatch(/^RM 50\.00/);
    });
  });

  describe("pet name", () => {
    it("resolves an animal by name, case-insensitively", () => {
      renderAt("pet=bella&freq=monthly");

      // `PetDetailView` builds this link with the display name, so the match has
      // to survive whatever casing a hand-edited or shared URL carries.
      expect(dedicatedTo()).toBe("Bella");
    });

    it("resolves the animal when the id and name agree", () => {
      // The pairing every link the app itself emits carries: `PetDetailView`
      // always writes `pet` and `sponsorPetId` from the same record.
      renderAt("sponsorPetId=pet-002&pet=Tiger&freq=monthly");

      expect(dedicatedTo()).toBe("Tiger");
    });

    it("resolves by catalogue order when a hand-edited link disagrees", () => {
      // Documents current behaviour rather than prescribing it. The lookup is a
      // single `find` over an OR of the two keys, so the earlier animal in the
      // catalogue wins regardless of which key matched — here `pet=Bella` beats
      // `sponsorPetId=pet-002` purely because Bella is listed first. The id is
      // the unambiguous key and arguably should take precedence; nothing the
      // app generates can produce a disagreeing pair, so this is recorded as a
      // wrinkle in docs/tasks/TARGET_TEST_TIERS_3_4_5_EXECUTION.md rather than
      // changed here.
      renderAt("sponsorPetId=pet-002&pet=Bella&freq=monthly");

      expect(dedicatedTo()).toBe("Bella");
    });
  });

  describe("tier", () => {
    it("preselects the tier named in the query", () => {
      renderAt("tier=kibble");

      expect(selectedAmount()).toMatch(/^RM 30\.00/);
    });

    it("matches a tier id case-insensitively", () => {
      renderAt("tier=EMERGENCY_MEDICAL");

      expect(selectedAmount()).toMatch(/^RM 250\.00/);
    });

    it("falls back to the default tier for an unknown id", () => {
      renderAt("tier=platinum");

      expect(selectedAmount()).toMatch(/^RM 50\.00/);
    });
  });

  describe("frequency", () => {
    it("opens on monthly giving when the query asks for it", () => {
      renderAt("freq=monthly");

      expect(selectedAmount()).toMatch(/\/ mo/);
    });

    it("ignores a frequency outside the supported pair", () => {
      renderAt("freq=weekly");

      expect(selectedAmount()).not.toMatch(/\/ mo/);
    });
  });

  describe("the full link PetDetailView emits", () => {
    it("applies animal, tier and frequency together", () => {
      renderAt("pet=Bella&sponsorPetId=pet-001&tier=kibble&freq=monthly");

      expect(dedicatedTo()).toBe("Bella");
      expect(selectedAmount()).toMatch(/^RM 30\.00/);
      expect(selectedAmount()).toMatch(/\/ mo/);
    });
  });
});
