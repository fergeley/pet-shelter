import { ReactNode } from "react";
import { getCurrentSupporterTier } from "@/lib/domain/sponsorAccess";
import { meetsTier } from "@/lib/domain/supporterTier";
import { SupporterTier } from "@/types/supporter";
import { UpgradeNudge } from "./UpgradeNudge";

interface TierGateProps {
  requiredTier: SupporterTier;
  children: ReactNode;
  /** Rendered instead of the default nudge when the standing is insufficient. */
  fallback?: ReactNode;
  /** Names the pet in the nudge copy: "Upgrade to Gold to unlock Luna's video diary." */
  petName?: string;
  /** Names the privilege in the nudge copy, e.g. "rehabilitation video diary". */
  perkDescription?: string;
  perkDescriptionMs?: string;
}

/**
 * Renders `children` only when the signed-in sponsor's derived standing meets
 * `requiredTier`; otherwise renders an upgrade nudge.
 *
 * This is an async **Server Component** and must stay one. As a Client Component it would
 * be decoration rather than protection: `children` would already have been serialized
 * into the RSC payload before the gate ran, so the "locked" content would sit in the
 * browser waiting to be read out of devtools.
 *
 * ## The contract this component cannot enforce for you
 *
 * `children` is a JSX element the *caller* builds. The gate controls whether it is
 * rendered, but not whether the caller fetched a secret to construct it. This is safe:
 *
 * ```tsx
 * <TierGate requiredTier="GOLD">
 *   <VideoDiary petId={pet.id} />   // fetches inside, only if rendered
 * </TierGate>
 * ```
 *
 * and this leaks, because the URL is loaded before the gate ever runs:
 *
 * ```tsx
 * const videos = await loadPrivateVideos(pet.id)   // <- already fetched
 * <TierGate requiredTier="GOLD">
 *   <VideoList videos={videos} />
 * </TierGate>
 * ```
 *
 * For anything genuinely sensitive, do not rely on this component alone. Use the gated
 * readers in `@/lib/domain/sponsorAccess` (`getGatedPetVideoDiary`,
 * `getGatedPetGallery`), which resolve the standing *before* producing a payload and
 * whose locked branch has no `items` field for a caller to read.
 */
export async function TierGate({
  requiredTier,
  children,
  fallback,
  petName,
  perkDescription,
  perkDescriptionMs,
}: TierGateProps) {
  const currentTier = await getCurrentSupporterTier();

  if (meetsTier(currentTier, requiredTier)) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <UpgradeNudge
      requiredTier={requiredTier}
      currentTier={currentTier}
      petName={petName}
      perkDescription={perkDescription}
      perkDescriptionMs={perkDescriptionMs}
    />
  );
}
