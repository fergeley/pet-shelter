"use client";

import { Pet } from "@/types/pet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { resolveDefaultPet } from "@/hooks/useAdoptionFormController";
import { AdoptionWizard } from "./AdoptionWizard";

/**
 * The adoption application as a modal, opened from a pet card or detail page.
 *
 * This is a presentation wrapper only: the wizard itself lives in
 * `AdoptionWizard` so that `/adopt` can render the very same form full-page
 * without a second implementation to keep in step.
 */
interface AdoptionFormProps {
  selectedPet: Pet | null;
  allPets: Pet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdoptionForm(props: AdoptionFormProps) {
  const { open, onOpenChange, selectedPet, allPets } = props;
  const { t } = useLanguage();
  const headlinePet = resolveDefaultPet(selectedPet, allPets);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 bg-card border-border">
        <DialogHeader className="mb-6 pb-3 border-b border-border">
          <DialogTitle className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {headlinePet
              ? `${t("adoptionForm.titleWithPet", "Adoption Application for")} ${headlinePet.name}`
              : t("adoptionForm.title", "Hope for Strays Adoption Application")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {t(
              "adoptionForm.subtitle",
              "Applications take about 5 minutes. Our volunteer coordinators in Petaling Jaya will review and follow up within 1–2 business days."
            )}
          </DialogDescription>
        </DialogHeader>

        <AdoptionWizard {...props} />
      </DialogContent>
    </Dialog>
  );
}
