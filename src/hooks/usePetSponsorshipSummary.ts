"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PetSponsorshipSummary, emptySponsorshipSummary } from "@/lib/domain/petSponsorship";
import { getPetSponsorshipSummaryAction } from "@/actions/sponsorships";

/**
 * Loads an animal's public sponsorship figures after mount.
 *
 * `/pets/[id]` is prerendered through `generateStaticParams`, so anything read
 * during render is fixed at build time — a supporter count read there would
 * never change again. These figures move whenever a coordinator reconciles a
 * transfer, so they are fetched on the client instead.
 *
 * Nothing here writes state before its first `await`: a synchronous setState
 * inside an effect makes React re-render before it has finished committing, and
 * the compiler lint rejects it.
 */
export function usePetSponsorshipSummary(petId: string) {
  const [summary, setSummary] = useState<PetSponsorshipSummary | null>(null);

  // Bumped on unmount and whenever petId changes, so a slow response cannot
  // write figures for an animal the visitor has already navigated away from.
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++generation.current;

    let next: PetSponsorshipSummary;
    try {
      next = await getPetSponsorshipSummaryAction(petId);
    } catch {
      // Never take the profile down over a figures lookup. A zeroed summary
      // renders as "no supporters yet", which is the honest degraded answer.
      next = emptySponsorshipSummary(petId);
    }

    if (mine !== generation.current) return;
    setSummary(next);
  }, [petId]);

  useEffect(() => {
    refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh]);

  return { summary, refresh };
}
