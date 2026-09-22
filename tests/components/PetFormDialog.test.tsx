import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { PetFormDialog } from "@/components/admin/PetFormDialog";
import {
  approximateBirthDate,
  computeAgeCategory,
  formatAgeString,
} from "@/lib/domain/petAge";
import { makePet, renderWithLanguage } from "./support/render";

/**
 * Tier 4 cover for the birth-date/age coupling in the admin pet form.
 *
 * The two fields write to each other, and the direction of the write is decided
 * by the "Estimated birthday" flag — which is exactly the piece that regressed:
 * a picked calendar date was still filed as an estimate, so the next keystroke
 * in Age silently replaced the operator's exact birthday with intake-minus-N.
 *
 * Interactions are `fireEvent.change` rather than `user-event`. Both handlers
 * read `e.target.value` as a whole expression ("3 years 2 months"), so typing it
 * character by character would fire the derivation once per keystroke and the
 * assertion would be about the last prefix, not about what was entered.
 */

/**
 * The intake date the dialog defaults to for a new animal —
 * `new Date().toISOString().split("T")[0]`, i.e. today in UTC. It is form state
 * with no rendered control, so a test that needs the derivation's reference
 * point has to compute it the same way rather than read it off the DOM.
 */
function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

/** A birthday an operator would pick from the calendar: unambiguous and well in the past. */
const EXACT_BIRTH_DATE = "2023-05-14";

function renderDialog(props: Partial<Parameters<typeof PetFormDialog>[0]> = {}) {
  const onSave = vi.fn();
  const onOpenChange = vi.fn();
  const result = renderWithLanguage(
    <PetFormDialog open onOpenChange={onOpenChange} onSave={onSave} {...props} />
  );
  return { ...result, onSave, onOpenChange };
}

const birthDateInput = () => screen.getByLabelText("Birth Date") as HTMLInputElement;
const estimateCheckbox = () =>
  screen.getByLabelText("Estimated birthday") as HTMLInputElement;
const ageInput = () => screen.getByLabelText(/age \(text\)/i) as HTMLInputElement;
const ageCategorySelect = () =>
  screen.getByLabelText(/age stage/i) as HTMLSelectElement;

describe("PetFormDialog birth date and age", () => {
  it("defaults a new animal to an empty, estimated birthday", () => {
    renderDialog();

    expect(birthDateInput().value).toBe("");
    expect(estimateCheckbox().checked).toBe(true);
    expect(ageCategorySelect().value).toBe("adult");
  });

  it("fills age and age stage from a picked birth date and clears the estimate flag", async () => {
    renderDialog();
    expect(estimateCheckbox()).toBeChecked();

    fireEvent.change(birthDateInput(), { target: { value: EXACT_BIRTH_DATE } });

    await waitFor(() => {
      expect(ageInput().value).toBe(formatAgeString(EXACT_BIRTH_DATE).en);
    });
    // Independently of the helper above: whatever it produced has to be a real
    // age phrase, so an empty or `undefined` return could not satisfy both.
    expect(ageInput().value).toMatch(/^\d+ (year|years|month|months)$/);
    expect(ageCategorySelect().value).toBe(computeAgeCategory(EXACT_BIRTH_DATE));

    // The regression: reaching for the calendar is the claim that the birthday
    // is known, so the flag that says "roughly" has to come off.
    expect(estimateCheckbox()).not.toBeChecked();
  });

  it("moves the age stage off its default when the picked date says a different band", async () => {
    const sixMonthsAgo = approximateBirthDate("6 months", todayUtc()).birthDate;
    renderDialog();
    expect(ageCategorySelect().value).toBe("adult");

    fireEvent.change(birthDateInput(), { target: { value: sixMonthsAgo } });

    // Asserted as a literal band rather than through `computeAgeCategory`: the
    // point is that the select actually moved, and re-deriving it here would
    // pass just as happily if the dialog had never written to the field.
    await waitFor(() => expect(ageCategorySelect().value).toBe("puppy_kitten"));
    expect(ageInput().value).toMatch(/months?$/);
  });

  it("derives an approximate birth date from an age that names a unit", async () => {
    const intakeDate = todayUtc();
    renderDialog();
    expect(birthDateInput().value).toBe("");

    fireEvent.change(ageInput(), { target: { value: "2 years" } });

    const expected = approximateBirthDate("2 years", intakeDate).birthDate;
    await waitFor(() => expect(birthDateInput().value).toBe(expected));
    // An approximation is not a birthday anyone stated, so the flag stays on.
    expect(estimateCheckbox()).toBeChecked();
    // Two years back from intake, not intake itself — the arithmetic ran.
    expect(expected).not.toBe(intakeDate);
    expect(ageCategorySelect().value).toBe("young");
  });

  it("derives nothing from a bare number", async () => {
    renderDialog();

    fireEvent.change(ageInput(), { target: { value: "2" } });

    // Waiting on the typed value first: asserting the empty birth date alone
    // would pass before the handler had run at all.
    await waitFor(() => expect(ageInput().value).toBe("2"));
    expect(birthDateInput().value).toBe("");
    expect(estimateCheckbox()).toBeChecked();
  });

  it("keeps an exact birth date when the age text is edited afterwards", async () => {
    const intakeDate = todayUtc();
    renderDialog();

    fireEvent.change(birthDateInput(), { target: { value: EXACT_BIRTH_DATE } });
    // Settling on the derived age, not on the estimate flag: the flag is the
    // subject of the test above, and waiting on it here would make this test
    // fail during its own arrangement instead of on the overwrite it is about.
    await waitFor(() => {
      expect(ageInput().value).toBe(formatAgeString(EXACT_BIRTH_DATE).en);
    });

    fireEvent.change(ageInput(), { target: { value: "3 years 2 months" } });

    await waitFor(() => expect(ageInput().value).toBe("3 years 2 months"));
    expect(birthDateInput().value).toBe(EXACT_BIRTH_DATE);
    // Naming the value the old behaviour wrote, so this cannot pass by the
    // field having been cleared or left untouched for some other reason.
    expect(birthDateInput().value).not.toBe(
      approximateBirthDate("3 years 2 months", intakeDate).birthDate
    );
  });

  it("reckons a typed age from today, not from the intake date", async () => {
    // An animal resident since January 2023, whose birthday is still only a guess. Six years is
    // chosen so the derived birthday lands *before* intake and the cross-field rule stays quiet:
    // the subject here is which day the arithmetic counts back from, nothing else.
    const editingPet = makePet({
      intakeDate: "2023-01-10",
      birthDate: "2020-01-10",
      birthDateIsEstimate: true,
    });
    renderDialog({ editingPet });
    await waitFor(() => expect(birthDateInput().value).toBe("2020-01-10"));

    fireEvent.change(ageInput(), { target: { value: "6 years" } });

    const fromToday = approximateBirthDate("6 years", todayUtc()).birthDate;
    const fromIntake = approximateBirthDate("6 years", editingPet.intakeDate).birthDate;
    expect(fromToday).not.toBe(fromIntake);

    await waitFor(() => expect(birthDateInput().value).toBe(fromToday));
    // Naming the value the intake-anchored arithmetic produced: an operator who types the age
    // the animal is *now* must not have it stored as the age it was when it arrived, which is
    // the drift the birth date field exists to end.
    expect(birthDateInput().value).not.toBe(fromIntake);
  });

  it("reads Malay age units the same as English ones", async () => {
    const intakeDate = todayUtc();
    renderDialog();

    fireEvent.change(ageInput(), { target: { value: "4 bulan" } });

    const expected = approximateBirthDate("4 months", intakeDate).birthDate;
    await waitFor(() => expect(birthDateInput().value).toBe(expected));
    expect(expected).not.toBe(intakeDate);
  });

  it("reads Malay years the same as English ones", async () => {
    const intakeDate = todayUtc();
    renderDialog();

    fireEvent.change(ageInput(), { target: { value: "2 tahun" } });

    const expected = approximateBirthDate("2 years", intakeDate).birthDate;
    await waitFor(() => expect(birthDateInput().value).toBe(expected));
    expect(expected).not.toBe(intakeDate);
  });
});
