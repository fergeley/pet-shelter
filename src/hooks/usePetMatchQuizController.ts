"use client";

import { useState, useMemo } from "react";
import { Pet } from "@/types/pet";
import { QuizAnswers, PetMatchResult } from "@/types/match";
import { matchPetsWithQuiz } from "@/lib/matchEngine";
import { usePetStore } from "@/lib/client/petStore";

export interface UsePetMatchQuizControllerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPet?: (pet: Pet) => void;
  onApplyForPet?: (pet: Pet) => void;
}

export function usePetMatchQuizController({
  onOpenChange,
  onSelectPet,
  onApplyForPet,
}: UsePetMatchQuizControllerProps) {
  const { pets } = usePetStore();
  const [step, setStep] = useState<number>(1);
  const [answers, setAnswers] = useState<QuizAnswers>({
    housing: "condo_apartment",
    household: "adults_only",
    existingPets: "none",
    dailyActivity: "moderate_30_60m",
    experience: "some_experience",
    preferredSpecies: "any",
  });

  const [isCalculated, setIsCalculated] = useState(false);

  const matchResults: PetMatchResult[] = useMemo(() => {
    if (!isCalculated) return [];
    return matchPetsWithQuiz(pets, answers);
  }, [pets, answers, isCalculated]);

  const handleNext = () => {
    if (step < 4) {
      setStep((s) => s + 1);
    } else {
      setIsCalculated(true);
    }
  };

  const handlePrev = () => {
    if (isCalculated) {
      setIsCalculated(false);
    } else if (step > 1) {
      setStep((s) => s - 1);
    }
  };

  const handleReset = () => {
    setStep(1);
    setIsCalculated(false);
    setAnswers({
      housing: "condo_apartment",
      household: "adults_only",
      existingPets: "none",
      dailyActivity: "moderate_30_60m",
      experience: "some_experience",
      preferredSpecies: "any",
    });
  };

  const handleSelectPet = (pet: Pet) => {
    onOpenChange(false);
    if (onSelectPet) {
      onSelectPet(pet);
    }
  };

  const handleApplyForPet = (pet: Pet) => {
    onOpenChange(false);
    if (onApplyForPet) {
      onApplyForPet(pet);
    }
  };

  return {
    state: {
      step,
      answers,
      isCalculated,
      matchResults,
    },
    handlers: {
      setStep,
      setAnswers,
      setIsCalculated,
      handleNext,
      handlePrev,
      handleReset,
      handleSelectPet,
      handleApplyForPet,
    },
  };
}
