"use client";

import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Pet } from "@/types/pet";
import { useApplicationStore } from "@/lib/client/applicationStore";
import { submitApplication } from "@/actions/applications";

export const adoptionFormSchema = z.object({
  petId: z.string().min(1, "Please select an adoptable pet"),
  petName: z.string().min(1, "Pet name is required"),
  applicantName: z.string().min(2, "Please enter your full name"),
  applicantEmail: z.string().email("Please enter a valid email address"),
  applicantPhone: z.string().min(9, "Please enter a valid Malaysian phone number"),
  applicantAddress: z.string().min(5, "Please provide your residential address and city"),
  housingType: z.enum(["landed_terrace", "semi_d_bungalow", "condo_apartment", "townhouse", "other"]),
  hasFencedYard: z.enum(["yes", "no", "not_applicable"]),
  currentPets: z.enum(["none", "dogs", "cats", "both", "other"]),
  currentPetDetails: z.string().optional(),
  householdExperience: z.enum(["first_time", "some_experience", "experienced"]),
  applicantNotes: z.string().optional(),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "Please agree to the adoption terms to submit your application",
  }),
});

export type AdoptionFormValues = z.infer<typeof adoptionFormSchema>;

export interface UseAdoptionFormControllerProps {
  selectedPet: Pet | null;
  allPets: Pet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useAdoptionFormController({
  selectedPet,
  allPets,
  open,
  onOpenChange,
}: UseAdoptionFormControllerProps) {
  const { addApplication } = useApplicationStore();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<AdoptionFormValues | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const availablePets = allPets.filter((p) => p.status === "Available");
  const defaultPet = selectedPet || availablePets[0] || allPets[0] || null;

  const form = useForm<AdoptionFormValues>({
    resolver: zodResolver(adoptionFormSchema),
    defaultValues: {
      petId: defaultPet?.id || "",
      petName: defaultPet?.name || "",
      applicantName: "",
      applicantEmail: "",
      applicantPhone: "",
      applicantAddress: "",
      housingType: "landed_terrace",
      hasFencedYard: "yes",
      currentPets: "none",
      currentPetDetails: "",
      householdExperience: "experienced",
      applicantNotes: "",
      agreeToTerms: true,
    },
  });

  const { setValue, control, reset } = form;

  useEffect(() => {
    if (selectedPet && open) {
      setValue("petId", selectedPet.id);
      setValue("petName", selectedPet.name);
    }
  }, [selectedPet, open, setValue]);

  const activePetId = useWatch({ control, name: "petId" }) || defaultPet?.id;
  const activePet = allPets.find((p) => p.id === activePetId) || selectedPet;

  const onSubmit = async (data: AdoptionFormValues) => {
    setSubmissionError(null);
    try {
      const res = await submitApplication({
        petId: data.petId,
        petName: data.petName,
        applicantName: data.applicantName,
        email: data.applicantEmail,
        phone: data.applicantPhone,
        address: data.applicantAddress,
        housingType: data.housingType,
        hasFencedYard: data.hasFencedYard,
        currentPets: data.currentPets,
        currentPetDetails: data.currentPetDetails,
        householdExperience: data.householdExperience,
        applicantNotes: data.applicantNotes,
      });

      if (!res.success) {
        setSubmissionError(res.error || "Failed to submit adoption application. Please try again.");
        return;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection error while submitting application.";
      setSubmissionError(msg);
      return;
    }

    addApplication({
      petId: data.petId,
      petName: data.petName,
      applicantName: data.applicantName,
      email: data.applicantEmail,
      phone: data.applicantPhone,
      address: data.applicantAddress,
      housingType: data.housingType,
      hasFencedYard: data.hasFencedYard,
      currentPets: data.currentPets,
      currentPetDetails: data.currentPetDetails,
      householdExperience: data.householdExperience,
      applicantNotes: data.applicantNotes,
    });
    setSubmittedData(data);
    setIsSubmitted(true);
  };

  const handleClose = () => {
    onOpenChange(false);
    if (isSubmitted) {
      setTimeout(() => {
        setIsSubmitted(false);
        setSubmissionError(null);
        reset();
      }, 200);
    } else {
      setSubmissionError(null);
    }
  };

  return {
    state: {
      availablePets,
      defaultPet,
      activePet,
      isSubmitted,
      submittedData,
      submissionError,
    },
    form,
    handlers: {
      onSubmit,
      handleClose,
      setIsSubmitted,
      setSubmissionError,
    },
  };
}
