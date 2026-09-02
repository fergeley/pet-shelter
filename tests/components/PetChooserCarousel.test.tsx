import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { PetChooserCarousel } from "@/components/features/donations/PetChooserCarousel";
import { renderWithLanguage, setupUser, makePet } from "./support/render";

const bella = makePet({ id: "pet-001", name: "Bella", breed: "Labrador Mix", species: "dog" });
const tiger = makePet({
  id: "pet-002",
  name: "Tiger",
  breed: "Domestic Shorthair",
  species: "cat",
  status: "In Rehabilitation",
});

function renderCarousel(selectedPetId: string | null = "general") {
  const onSelectPet = vi.fn();
  renderWithLanguage(
    <PetChooserCarousel pets={[bella, tiger]} selectedPetId={selectedPetId} onSelectPet={onSelectPet} />
  );
  return { onSelectPet, user: setupUser() };
}

describe("PetChooserCarousel", () => {
  it("exposes the track as a labelled region", () => {
    renderCarousel();

    expect(screen.getByRole("region", { name: /pet selection carousel/i })).toBeInTheDocument();
  });

  it("renders the general fund alongside every supplied animal", () => {
    renderCarousel();

    expect(screen.getByRole("button", { name: /general sanctuary fund/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bella/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tiger/i })).toBeInTheDocument();
  });

  describe("selection", () => {
    it("exposes aria-pressed on the active general fund selection", () => {
      renderCarousel("general");

      expect(screen.getByRole("button", { name: /general sanctuary fund/i })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /bella/i })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: /tiger/i })).toHaveAttribute("aria-pressed", "false");
    });

    it("exposes aria-pressed on the dedicated animal selection", () => {
      renderCarousel("pet-001");

      expect(screen.getByRole("button", { name: /bella/i })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /general sanctuary fund/i })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: /tiger/i })).toHaveAttribute("aria-pressed", "false");
    });

    it("hands the whole pet back when an animal is chosen", async () => {
      const { onSelectPet, user } = renderCarousel();

      await user.click(screen.getByRole("button", { name: /bella/i }));

      // The parent needs the record, not just an id: `DonationWidget` derives
      // the receipt's `targetPetName` from it in the same handler.
      expect(onSelectPet).toHaveBeenCalledWith(bella);
    });

    it("signals the general fund with null rather than a sentinel id", async () => {
      const { onSelectPet, user } = renderCarousel("pet-001");

      await user.click(screen.getByRole("button", { name: /general sanctuary fund/i }));

      // `null` is what clears `targetPetName` upstream. Passing the string
      // "general" would dedicate the receipt to an animal that does not exist.
      expect(onSelectPet).toHaveBeenCalledWith(null);
    });

    it("keeps a dedicated animal selectable when the general fund is active", async () => {
      const { onSelectPet, user } = renderCarousel(null);

      await user.click(screen.getByRole("button", { name: /tiger/i }));

      expect(onSelectPet).toHaveBeenCalledWith(tiger);
    });
  });

  describe("status presentation", () => {
    it("labels a rehabilitating animal differently from an adoptable one", () => {
      renderCarousel();

      // Exact strings, not regexes: each card carries both a status badge
      // ("In Rehabilitation") and a shorter footer verdict ("In Rehab"), and a
      // loose match would happily find either and prove neither.
      expect(within(screen.getByRole("button", { name: /tiger/i })).getByText("In Rehab")).toBeInTheDocument();
      expect(within(screen.getByRole("button", { name: /tiger/i })).getByText("In Rehabilitation")).toBeInTheDocument();
      expect(within(screen.getByRole("button", { name: /bella/i })).getByText("Adoptable")).toBeInTheDocument();
    });

    it("translates the status footer when the language is ms", () => {
      renderWithLanguage(
        <PetChooserCarousel pets={[tiger]} selectedPetId="general" onSelectPet={vi.fn()} />,
        { language: "ms" }
      );

      expect(screen.getByText(/program rawatan/i)).toBeInTheDocument();
    });
  });

  describe("scroll affordances", () => {
    it("labels both scroll buttons for assistive technology", () => {
      renderCarousel();

      expect(screen.getByRole("button", { name: /scroll left/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /scroll right/i })).toBeInTheDocument();
    });

    it("scrolls the track without submitting a surrounding form", async () => {
      const { user } = renderCarousel();
      const track = screen.getByRole("region", { name: /pet selection carousel/i });
      const scrollBy = vi.spyOn(track, "scrollBy").mockImplementation(() => {});

      await user.click(screen.getByRole("button", { name: /scroll right/i }));

      expect(scrollBy).toHaveBeenCalled();
      // The carousel sits inside the donation form; an untyped button would
      // default to `type="submit"` and pledge on every arrow click.
      expect(screen.getByRole("button", { name: /scroll right/i })).toHaveAttribute("type", "button");
    });
  });
});
