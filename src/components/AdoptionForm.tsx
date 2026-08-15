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

interface AdoptionFormProps {
  selectedPet: Pet | null;
  allPets: Pet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdoptionForm(props: AdoptionFormProps) {
  const { open, allPets } = props;
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
                {activePet ? `Adoption Application for ${activePet.name}` : "Hope for Strays Adoption Application"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Applications take about 5 minutes. Our volunteer coordinators in Petaling Jaya will review and follow up within 1–2 business days.
              </DialogDescription>
            </DialogHeader>

            {submissionError && (
              <div className="mb-6 bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive font-medium flex items-center gap-2">
                <span>⚠️ {submissionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Pet Selection */}
              <div className="space-y-2 bg-muted/40 border border-border p-4">
                <Label htmlFor="petId" className="text-sm font-bold text-foreground">
                  Selected Rescue Animal
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
                  className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium"
                >
                  {allPets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.breed} ({p.status} • {p.adoptionFee.toLowerCase().includes("free") ? "Free Adoption" : p.adoptionFee})
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
                  1. Contact Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="applicantName" className="text-sm font-semibold">Full Name *</Label>
                    <Input
                      id="applicantName"
                      placeholder="e.g. Tan Mei Ling"
                      className="text-sm sm:text-base py-2.5"
                      {...register("applicantName")}
                    />
                    {errors.applicantName && (
                      <p className="text-sm font-medium text-destructive mt-1">{errors.applicantName.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="applicantEmail" className="text-sm font-semibold">Email Address *</Label>
                    <Input
                      id="applicantEmail"
                      type="email"
                      placeholder="meiling@example.com"
                      className="text-sm sm:text-base py-2.5"
                      {...register("applicantEmail")}
                    />
                    {errors.applicantEmail && (
                      <p className="text-sm font-medium text-destructive mt-1">{errors.applicantEmail.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="applicantPhone" className="text-sm font-semibold">Phone / WhatsApp Number *</Label>
                    <Input
                      id="applicantPhone"
                      placeholder="012-345 6789"
                      className="text-sm sm:text-base py-2.5 font-mono"
                      {...register("applicantPhone")}
                    />
                    {errors.applicantPhone && (
                      <p className="text-sm font-medium text-destructive mt-1">{errors.applicantPhone.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="applicantAddress" className="text-sm font-semibold">Address & Area (Selangor / KL) *</Label>
                    <Input
                      id="applicantAddress"
                      placeholder="No. 12, Jalan SS 2/10, Petaling Jaya"
                      className="text-sm sm:text-base py-2.5"
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
                  2. Housing & Compound
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="housingType" className="text-sm font-semibold">Housing Type *</Label>
                    <select
                      id="housingType"
                      {...register("housingType")}
                      className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium"
                    >
                      <option value="landed_terrace">Landed Terrace House</option>
                      <option value="semi_d_bungalow">Semi-D / Bungalow with Compound</option>
                      <option value="condo_apartment">Condo / Apartment (Pet-Friendly)</option>
                      <option value="townhouse">Townhouse</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hasFencedYard" className="text-sm font-semibold">Fenced Compound / Gate *</Label>
                    <select
                      id="hasFencedYard"
                      {...register("hasFencedYard")}
                      className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium"
                    >
                      <option value="yes">Yes (Secure gate & fenced compound)</option>
                      <option value="no">No</option>
                      <option value="not_applicable">Not applicable (Indoor Cat adoption)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Household Pets */}
              <div className="space-y-4 pt-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border pb-1.5">
                  3. Household Pets & Experience
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPets" className="text-sm font-semibold">Current Household Pets *</Label>
                    <select
                      id="currentPets"
                      {...register("currentPets")}
                      className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium"
                    >
                      <option value="none">No current pets</option>
                      <option value="dogs">Dogs only</option>
                      <option value="cats">Cats only</option>
                      <option value="both">Both dogs and cats</option>
                      <option value="other">Other pets</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="householdExperience" className="text-sm font-semibold">Pet Ownership Experience *</Label>
                    <select
                      id="householdExperience"
                      {...register("householdExperience")}
                      className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium"
                    >
                      <option value="experienced">Experienced pet owner (5+ years)</option>
                      <option value="some_experience">Some experience</option>
                      <option value="first_time">First-time pet owner</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="currentPetDetails" className="text-sm font-semibold">Current Pet Details (Optional)</Label>
                  <Input
                    id="currentPetDetails"
                    placeholder="e.g. 5-year-old neutered local dog, vaccinated"
                    className="text-sm sm:text-base py-2.5"
                    {...register("currentPetDetails")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="applicantNotes" className="text-sm font-semibold">Additional Notes (Optional)</Label>
                  <Textarea
                    id="applicantNotes"
                    rows={2}
                    placeholder="Tell us about your daily routine or any questions..."
                    className="text-sm sm:text-base py-2"
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
                    className="mt-1 size-4.5 accent-foreground shrink-0"
                  />
                  <label htmlFor="agreeToTerms" className="text-sm text-foreground/90 leading-relaxed cursor-pointer">
                    I certify that all information in this application is accurate. I understand that Hope for Strays prioritizes animal welfare and will conduct a standard screening before final adoption.
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
                  className="w-full sm:w-auto text-sm font-semibold px-5 py-2.5 focus-visible:ring-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto text-sm font-semibold px-7 py-2.5 focus-visible:ring-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4.5 animate-spin mr-1.5" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Confirmation */
          <div className="py-6 px-2 text-center space-y-4">
            <div className="mx-auto flex size-14 items-center justify-center bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
                Application Submitted
              </h2>
              <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                Thank you, {submittedData?.applicantName}. We received your application for <strong>{submittedData?.petName}</strong>. Our volunteer adoption team in Petaling Jaya will contact you via WhatsApp/Email at {submittedData?.applicantEmail} within 1–2 business days.
              </p>
            </div>

            <div className="bg-muted/40 border border-border p-5 text-left text-sm space-y-2 max-w-md mx-auto text-foreground/90 leading-relaxed">
              <p className="font-bold text-foreground text-sm">Next steps:</p>
              <p>1. Volunteer screening of housing situation.</p>
              <p>2. Quick phone/WhatsApp check-in with our coordinator.</p>
              <p>3. Visit our Petaling Jaya sanctuary for a meet-and-greet.</p>
            </div>

            <div className="pt-3">
              <Button onClick={handleClose} size="sm" className="text-sm font-semibold px-6 py-2">
                Back to Pets
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
