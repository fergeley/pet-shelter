"use client";

import { useState } from "react";
import { Pet } from "@/types/pet";
import { usePetStore } from "@/lib/petStore";
import { getPetStatusPresentation } from "@/lib/petStatusPresentation";

export interface UsePetDetailViewControllerProps {
  initialPet: Pet;
}

export function usePetDetailViewController({ initialPet }: UsePetDetailViewControllerProps) {
  const { pets } = usePetStore();

  // Hydrate with client store version if available
  const pet = pets.find((p) => p.id === initialPet.id) || initialPet;
  const statusPresentation = getPetStatusPresentation(pet.status);
  const isAvailable = statusPresentation.isAdoptable;

  // Modals & Links
  const [isAdoptionOpen, setIsAdoptionOpen] = useState(false);
  const [isSponsorshipOpen, setIsSponsorshipOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // WhatsApp Inquiry URL pre-filled
  const waMessage = encodeURIComponent(
    `Hello Hope for Strays Selangor! I am interested in inquiring about adopting ${pet.name} (${pet.breed}, Ref: ${pet.id}). Could you let me know about visiting arrangements?`
  );
  const waUrl = `https://wa.me/60127876543?text=${waMessage}`;

  const handleShare = async () => {
    if (typeof window !== "undefined") {
      const shareData = {
        title: `Adopt ${pet.name} | Hope for Strays Petaling Jaya`,
        text: `Meet ${pet.name}, a lovable ${pet.breed} looking for a forever home in Selangor!`,
        url: window.location.href,
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch {
          // Fallback to clipboard
        }
      }

      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return {
    state: {
      pet,
      pets,
      isAvailable,
      statusPresentation,
      isAdoptionOpen,
      isSponsorshipOpen,
      copiedLink,
      waUrl,
    },
    handlers: {
      setIsAdoptionOpen,
      setIsSponsorshipOpen,
      handleShare,
    },
  };
}
