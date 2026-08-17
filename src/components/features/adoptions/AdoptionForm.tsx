"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { Pet } from "@/types/pet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdoptionFormController } from "@/hooks/useAdoptionFormController";
import { useLanguage } from "@/components/LanguageProvider";

interface AdoptionFormProps {
  selectedPet: Pet | null;
  allPets: Pet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdoptionForm(props: AdoptionFormProps) {
  const { open, allPets } = props;
  const { t, isMs } = useLanguage();
  const { state, form, handlers } = useAdoptionFormController(props);
  const { activePet, isSubmitted, submittedData, submissionError } = state;
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = form;
  const { onSubmit, handleClose } = handlers;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 bg-card border-border">
        {!isSubmitted ? (
          <div>
            <DialogHeader className="mb-6 pb-3 border-b border-border">
              <DialogTitle className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {activePet
                  ? `${t("adoptionForm.titleWithPet", "Adoption Application for")} ${activePet.name}`
                  : t("adoptionForm.title", "Hope for Strays Adoption Application")}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {t("adoptionForm.subtitle", "Applications take about 5 minutes. Our volunteer coordinators in Petaling Jaya will review and follow up within 1–2 business days.")}
              </DialogDescription>
            </DialogHeader>

            {submissionError && (
              <div className="mb-6 bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive font-medium flex items-center gap-2 rounded-xl">
                <span>⚠️ {submissionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Pet Selection */}
              <div className="space-y-2 bg-muted/40 border border-border p-4 rounded-xl">
                <Label htmlFor="petId" className="text-sm font-bold text-foreground">
                  {t("adoptionForm.selectedPetLabel", "Selected Rescue Animal")}
                </Label>
                <select
                  id="petId"
                  {...register("petId")}
                  onChange={(e) => {
                    const pet = allPets.find((p) => p.id === e.target.value);
                    if (pet) {
                      setValue("petId", pet.id);
                      setValue("petName", pet.name);
                    }
                  }}
                  className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium rounded-lg"
                >
                  {allPets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.breed} ({p.status} • {p.adoptionFee.toLowerCase().includes("free") ? (isMs ? "Adopsi Percuma" : "Free Adoption") : p.adoptionFee})
                    </option>
                  ))}
                </select>
                {errors.petId && (
                  <p className="text-sm font-medium text-destructive mt-1">{errors.petId.message}</p>
                )}
              </div>

              {/* 1. Applicant Contact Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border pb-1.5">
                  1. {isMs ? "Maklumat Pemohon & Hubungan" : "Contact Information"}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="applicantName" className="text-sm font-semibold">
                      {t("adoptionForm.applicantNameLabel", "Full Name (as per IC / Passport) *")}
                    </Label>
                    <Input
                      id="applicantName"
                      placeholder={t("adoptionForm.applicantNamePlaceholder", "e.g. Nurul Huda binti Ahmad")}
                      className="text-sm sm:text-base py-2.5 rounded-lg"
                      {...register("applicantName")}
                    />
                    {errors.applicantName && (
                      <p className="text-sm font-medium text-destructive mt-1">{errors.applicantName.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="applicantEmail" className="text-sm font-semibold">
                      {t("adoptionForm.emailLabel", "Email Address *")}
                    </Label>
                    <Input
                      id="applicantEmail"
                      type="email"
                      placeholder="nurul@example.com"
                      className="text-sm sm:text-base py-2.5 rounded-lg"
                      {...register("applicantEmail")}
                    />
                    {errors.applicantEmail && (
                      <p className="text-sm font-medium text-destructive mt-1">{errors.applicantEmail.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="applicantPhone" className="text-sm font-semibold">
                      {t("adoptionForm.phoneLabel", "Contact Phone Number (WhatsApp accessible) *")}
                    </Label>
                    <Input
                      id="applicantPhone"
                      placeholder="012-345 6789"
                      className="text-sm sm:text-base py-2.5 font-mono rounded-lg"
                      {...register("applicantPhone")}
                    />
                    {errors.applicantPhone && (
                      <p className="text-sm font-medium text-destructive mt-1">{errors.applicantPhone.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="applicantAddress" className="text-sm font-semibold">
                      {t("adoptionForm.addressLabel", "Residential Address (State & Postcode) *")}
                    </Label>
                    <Input
                      id="applicantAddress"
                      placeholder={t("adoptionForm.addressPlaceholder", "e.g. No. 24, Jalan SS 2/10, 47300 Petaling Jaya, Selangor")}
                      className="text-sm sm:text-base py-2.5 rounded-lg"
                      {...register("applicantAddress")}
                    />
                    {errors.applicantAddress && (
                      <p className="text-sm font-medium text-destructive mt-1">{errors.applicantAddress.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Housing Situation */}
              <div className="space-y-4 pt-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border pb-1.5">
                  2. {isMs ? "Maklumat Kediaman & Pagar" : "Housing & Compound"}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="housingType" className="text-sm font-semibold">
                      {t("adoptionForm.housingTypeLabel", "Housing & Accommodation Type *")}
                    </Label>
                    <select
                      id="housingType"
                      {...register("housingType")}
                      className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium rounded-lg"
                    >
                      <option value="own_house_yard">{t("adoptionForm.housingOwnHouse", "Landed House with Yard (Owned)")}</option>
                      <option value="rent_house_yard">{t("adoptionForm.housingRentHouse", "Landed House with Yard (Rented)")}</option>
                      <option value="apartment">{t("adoptionForm.housingApartment", "Apartment / Flat (Pet-friendly rules)")}</option>
                      <option value="condo">{t("adoptionForm.housingCondo", "Condominium (Pet-friendly management)")}</option>
                      <option value="other">{t("adoptionForm.housingOther", "Other Property Type")}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hasFencedYard" className="text-sm font-semibold">
                      {t("adoptionForm.fencedYardLabel", "Perimeter Fencing & Gate Security *")}
                    </Label>
                    <select
                      id="hasFencedYard"
                      {...register("hasFencedYard")}
                      className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium rounded-lg"
                    >
                      <option value="yes">{t("adoptionForm.yardYes", "Fully Fenced Perimeter (Secure gate)")}</option>
                      <option value="no">{t("adoptionForm.yardNo", "Open Compound / Unfenced Yard")}</option>
                      <option value="not_applicable">{t("adoptionForm.yardNA", "Not Applicable (Indoor high-rise)")}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Household Pets */}
              <div className="space-y-4 pt-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border pb-1.5">
                  3. {isMs ? "Haiwan Peliharaan Sedia Ada & Pengalaman" : "Household Pets & Experience"}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPets" className="text-sm font-semibold">
                      {t("adoptionForm.currentPetsLabel", "Current Resident Household Pets *")}
                    </Label>
                    <select
                      id="currentPets"
                      {...register("currentPets")}
                      className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium rounded-lg"
                    >
                      <option value="none">{t("adoptionForm.petsNone", "No current pets")}</option>
                      <option value="dogs">{t("adoptionForm.petsDogs", "Yes, currently have dog(s)")}</option>
                      <option value="cats">{t("adoptionForm.petsCats", "Yes, currently have cat(s)")}</option>
                      <option value="both">{t("adoptionForm.petsBoth", "Yes, have both dogs and cats")}</option>
                      <option value="other">{t("adoptionForm.petsOther", "Other small animals")}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="householdExperience" className="text-sm font-semibold">
                      {t("adoptionForm.householdExperienceLabel", "Pet Ownership Experience *")}
                    </Label>
                    <select
                      id="householdExperience"
                      {...register("householdExperience")}
                      className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium rounded-lg"
                    >
                      <option value="experienced">{t("adoptionForm.expExperienced", "Experienced pet owner & primary caregiver")}</option>
                      <option value="some_experience">{t("adoptionForm.expSome", "Some past experience with pets")}</option>
                      <option value="first_time">{t("adoptionForm.expFirstTime", "First-time pet owner")}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="currentPetDetails" className="text-sm font-semibold">
                    {t("adoptionForm.currentPetDetailsLabel", "Resident Pets Details (Breeds, Ages, Neutered Status)")}
                  </Label>
                  <Input
                    id="currentPetDetails"
                    placeholder={t("adoptionForm.currentPetDetailsPlaceholder", "e.g. 1 spayed female local cat (3 yrs), vaccinated.")}
                    className="text-sm sm:text-base py-2.5 rounded-lg"
                    {...register("currentPetDetails")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="applicantNotes" className="text-sm font-semibold">
                    {t("adoptionForm.notesLabel", "Household Daily Routine & Living Notes (Optional)")}
                  </Label>
                  <Textarea
                    id="applicantNotes"
                    rows={2}
                    placeholder={t("adoptionForm.notesPlaceholder", "Share details about daily schedule, exercise arrangements, and who will look after the pet during work hours...")}
                    className="text-sm sm:text-base py-2 rounded-lg"
                    {...register("applicantNotes")}
                  />
                </div>
              </div>

              {/* Terms */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="agreeToTerms"
                    {...register("agreeToTerms")}
                    className="mt-1 size-4.5 accent-foreground shrink-0 cursor-pointer"
                  />
                  <label htmlFor="agreeToTerms" className="text-sm text-foreground/90 leading-relaxed cursor-pointer">
                    {t("adoptionForm.termsAgreement", "I agree to the Shelter Adoption Terms, confirm all household members consent, and promise never to abandon or commercially breed this animal.")}
                  </label>
                </div>
                {errors.agreeToTerms && (
                  <p className="text-sm font-medium text-destructive mt-1">{errors.agreeToTerms.message}</p>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="border-t border-border pt-5 flex flex-col sm:flex-row items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="w-full sm:w-auto text-sm font-semibold px-5 py-2.5 focus-visible:ring-2 cursor-pointer"
                >
                  {t("common.close", "Cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto text-sm font-semibold px-7 py-2.5 focus-visible:ring-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4.5 animate-spin mr-1.5" />
                      {t("common.submitting", "Submitting...")}
                    </>
                  ) : (
                    t("adoptionForm.submitButton", "Submit 100% Free Adoption Application")
                  )}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Confirmation */
          <div className="py-6 px-2 text-center space-y-4">
            <div className="mx-auto flex size-14 items-center justify-center bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-full">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
                {t("adoptionForm.successTitle", "Application Submitted!")}
              </h2>
              <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                {isMs
                  ? `Terima kasih, ${submittedData?.applicantName}. Kami telah menerima permohonan anda untuk ${submittedData?.petName}. Penyelaras adopsi sukarelawan kami di Petaling Jaya akan menghubungi anda melalui WhatsApp/Emel dalam tempoh 1–2 hari bekerja.`
                  : `Thank you, ${submittedData?.applicantName}. We received your application for ${submittedData?.petName}. Our volunteer adoption team in Petaling Jaya will contact you via WhatsApp/Email within 1–2 business days.`}
              </p>
            </div>

            <div className="bg-muted/40 border border-border p-5 text-left text-sm space-y-2 max-w-md mx-auto text-foreground/90 leading-relaxed rounded-xl">
              <p className="font-bold text-foreground text-sm">{t("adoptionForm.nextStepsTitle", "What happens next?")}</p>
              <p>1. {t("adoptionForm.nextStep1", "Our adoption team will review your application within 24–48 hours.")}</p>
              <p>2. {t("adoptionForm.nextStep2", "We will contact you via WhatsApp to arrange an in-person Meet & Greet at our sanctuary.")}</p>
              <p>3. {t("adoptionForm.nextStep3", "Track live status anytime at /applications/track using your Reference ID and Email.")}</p>
            </div>

            <div className="pt-3">
              <Button onClick={handleClose} size="sm" className="text-sm font-semibold px-6 py-2 cursor-pointer">
                {t("common.backToAllPets", "Back to Pets")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
