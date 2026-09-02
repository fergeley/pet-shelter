import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";

/**
 * The controller calls this Server Action directly. Importing the real module
 * pulls `@/lib/server/prisma` — and through it `pg` — into jsdom, which is both
 * slow and meaningless here: Tier 4 is about what the form does with the
 * action's *answer*, and Tier 3 already owns whether the action is correct.
 *
 * Hoisted above the component import by Vitest, so the controller receives the
 * double rather than the real function.
 */
const submitApplication = vi.hoisted(() => vi.fn());
vi.mock("@/actions/applications", () => ({ submitApplication }));

import { AdoptionForm } from "@/components/features/adoptions/AdoptionForm";
import { adoptionFormSchema } from "@/hooks/useAdoptionFormController";
import { renderWithLanguage, setupUser, makePet } from "./support/render";

const VALID = {
  name: "Nurul Huda binti Ahmad",
  email: "nurul@example.com",
  phone: "012-345 6789",
  address: "No. 24, Jalan SS 2/10, 47300 Petaling Jaya, Selangor",
};

function renderForm(overrides: Partial<Parameters<typeof AdoptionForm>[0]> = {}) {
  const pet = makePet({ name: "Bella", breed: "Labrador Mix" });
  const onOpenChange = vi.fn();
  const result = renderWithLanguage(
    <AdoptionForm
      selectedPet={pet}
      allPets={[pet]}
      open
      onOpenChange={onOpenChange}
      {...overrides}
    />
  );
  return { ...result, pet, onOpenChange, user: setupUser() };
}

/** Fills every required text field with input the schema accepts. */
async function fillValidContact(user: ReturnType<typeof setupUser>) {
  await user.type(screen.getByLabelText(/full name/i), VALID.name);
  await user.type(screen.getByLabelText(/email address/i), VALID.email);
  await user.type(screen.getByLabelText(/contact phone number/i), VALID.phone);
  await user.type(screen.getByLabelText(/residential address/i), VALID.address);
}

const submitButton = () => screen.getByRole("button", { name: /submit/i });

beforeEach(() => {
  submitApplication.mockReset();
  submitApplication.mockResolvedValue({ success: true, data: { id: "app-1" } });
});

describe("AdoptionForm", () => {
  it("opens as a dialog naming the selected pet", () => {
    renderForm();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/adoption application for bella/i)).toBeInTheDocument();
  });

  it("preselects the designated pet in the animal chooser", () => {
    const { pet } = renderForm();

    expect(screen.getByLabelText(/selected rescue animal/i)).toHaveValue(pet.id);
  });

  describe("validation", () => {
    it("reports every empty required field rather than only the first", async () => {
      const { user } = renderForm();

      await user.click(submitButton());

      // Asserted together: react-hook-form resolves the whole schema per submit,
      // so a form surfacing only one message at a time would still pass a test
      // that checked them one by one.
      expect(await screen.findByText(/enter your full name/i)).toBeInTheDocument();
      expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/valid malaysian phone number/i)).toBeInTheDocument();
      expect(screen.getByText(/residential address and city/i)).toBeInTheDocument();
      expect(submitApplication).not.toHaveBeenCalled();
    });

    it("rejects a domainless email the browser would have accepted", async () => {
      const { user } = renderForm();
      await fillValidContact(user);

      // `nurul@example` deliberately: the field is `type="email"`, so anything
      // the browser's own constraint validation rejects (`nurul@@example`)
      // never reaches React at all — the submit event is cancelled and the Zod
      // message is never rendered. Only a value that passes native validation
      // and fails the schema proves the application's own layer is doing work.
      await user.clear(screen.getByLabelText(/email address/i));
      await user.type(screen.getByLabelText(/email address/i), "nurul@example");
      await user.click(submitButton());

      expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
      expect(submitApplication).not.toHaveBeenCalled();
    });

    it("rejects a phone number too short to be Malaysian", async () => {
      const { user } = renderForm();
      await fillValidContact(user);

      await user.clear(screen.getByLabelText(/contact phone number/i));
      await user.type(screen.getByLabelText(/contact phone number/i), "0123");
      await user.click(submitButton());

      expect(await screen.findByText(/valid malaysian phone number/i)).toBeInTheDocument();
      expect(submitApplication).not.toHaveBeenCalled();
    });

    it("blocks submission until the adoption terms are agreed", async () => {
      const { user } = renderForm();
      await fillValidContact(user);

      // The checkbox defaults to checked, so the gate is only observable by
      // clearing it — a test that merely left it alone would pass either way.
      await user.click(screen.getByRole("checkbox"));
      await user.click(submitButton());

      expect(await screen.findByText(/agree to the adoption terms/i)).toBeInTheDocument();
      expect(submitApplication).not.toHaveBeenCalled();
    });
  });

  describe("housing type contract", () => {
    /**
     * Regression guard. The markup used to offer `own_house_yard`,
     * `rent_house_yard`, `apartment` and `condo`, none of which
     * `adoptionFormSchema` accepts, and the select renders no error message —
     * so picking any of them failed validation silently and the submit button
     * appeared to do nothing at all.
     */
    it("offers exactly the values the schema accepts", () => {
      renderForm();

      const rendered = within(screen.getByLabelText(/housing & accommodation type/i))
        .getAllByRole("option")
        .map((option) => (option as HTMLOptionElement).value);

      expect([...rendered].sort()).toEqual([...adoptionFormSchema.shape.housingType.options].sort());
    });

    it("submits successfully with a housing type chosen from the control", async () => {
      const { user } = renderForm();
      await fillValidContact(user);

      await user.selectOptions(
        screen.getByLabelText(/housing & accommodation type/i),
        "condo_apartment"
      );
      await user.click(submitButton());

      await waitFor(() => expect(submitApplication).toHaveBeenCalledTimes(1));
      expect(submitApplication.mock.calls[0][0]).toMatchObject({
        housingType: "condo_apartment",
      });
    });
  });

  describe("submission", () => {
    it("sends the applicant's details to the server action", async () => {
      const { user, pet } = renderForm();
      await fillValidContact(user);

      await user.click(submitButton());

      await waitFor(() => expect(submitApplication).toHaveBeenCalledTimes(1));
      // The form's field names and the action's payload keys differ
      // (`applicantEmail` vs `email`), so this pins the mapping, not just the call.
      expect(submitApplication.mock.calls[0][0]).toMatchObject({
        petId: pet.id,
        petName: pet.name,
        applicantName: VALID.name,
        email: VALID.email,
        phone: VALID.phone,
        address: VALID.address,
      });
    });

    it("replaces the form with a confirmation naming the applicant and pet", async () => {
      const { user } = renderForm();
      await fillValidContact(user);

      await user.click(submitButton());

      expect(await screen.findByText(/application submitted/i)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(VALID.name, "i"))).toBeInTheDocument();
      expect(screen.getByText(/bella/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    });

    it("keeps the form open and shows the reason when the action refuses", async () => {
      submitApplication.mockResolvedValue({
        success: false,
        error: "This animal is currently archived and is no longer accepting new adoption applications.",
      });
      const { user } = renderForm();
      await fillValidContact(user);

      await user.click(submitButton());

      expect(await screen.findByText(/currently archived/i)).toBeInTheDocument();
      expect(screen.queryByText(/application submitted/i)).not.toBeInTheDocument();
      // Still editable, so the applicant can correct and retry.
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    it("surfaces a thrown transport error instead of failing silently", async () => {
      submitApplication.mockRejectedValue(new Error("Network unreachable"));
      const { user } = renderForm();
      await fillValidContact(user);

      await user.click(submitButton());

      expect(await screen.findByText(/network unreachable/i)).toBeInTheDocument();
      expect(screen.queryByText(/application submitted/i)).not.toBeInTheDocument();
    });

    it("disables the submit button while the action is in flight", async () => {
      let release!: (value: { success: boolean }) => void;
      submitApplication.mockReturnValue(
        new Promise<{ success: boolean }>((resolve) => {
          release = resolve;
        })
      );
      const { user } = renderForm();
      await fillValidContact(user);

      await user.click(submitButton());

      // Guards against a double-submit creating two applications for one animal.
      await waitFor(() => expect(submitButton()).toBeDisabled());

      release({ success: true });
      await waitFor(() => expect(screen.getByText(/application submitted/i)).toBeInTheDocument());
    });
  });

  describe("bilingual rendering", () => {
    it("renders Malay section headings when the language is ms", () => {
      renderWithLanguage(
        <AdoptionForm
          selectedPet={makePet({ name: "Bella" })}
          allPets={[makePet({ name: "Bella" })]}
          open
          onOpenChange={vi.fn()}
        />,
        { language: "ms" }
      );

      expect(screen.getByText(/maklumat pemohon/i)).toBeInTheDocument();
      expect(screen.getByText(/maklumat kediaman/i)).toBeInTheDocument();
    });
  });
});
