/**
 * Client-safe barrel for the sponsor portal.
 *
 * `TierGate` is deliberately absent. It is an async Server Component that imports the
 * `server-only` access layer, so re-exporting it here would poison every client import of
 * this barrel — and of `@/components/features`, which re-exports it. Server pages import
 * it directly from `@/components/features/sponsors/TierGate`.
 */
export { UpgradeNudge } from "./UpgradeNudge";
export { TierBadge } from "./TierBadge";
export { SponsorAuthForm } from "./SponsorAuthForm";
export { SponsorDashboardView } from "./SponsorDashboardView";
export { SponsorLogoutButton } from "./SponsorLogoutButton";
export { SponsorCertificate } from "./SponsorCertificate";
export { SponsorWallGrid } from "./SponsorWallGrid";
export { WallOptInToggle } from "./WallOptInToggle";
export { CaretakerQaBox } from "./CaretakerQaBox";
export { PetExclusiveMediaPanel } from "./PetExclusiveMediaPanel";
export { ExclusiveGalleryGrid, ExclusiveVideoDiary } from "./ExclusiveMedia";
