import { Clock, HeartHandshake, HomeIcon, Stethoscope, type LucideIcon } from "lucide-react";

import type { PetStatusTone } from "@/lib/presentation/petStatusPresentation";

/**
 * The glyph that stands for each status tone.
 *
 * Deliberately *not* a field on `PetStatusPresentation`: that module is imported by
 * `tests/unit/` under Vitest's node environment, and pulling a React icon package into
 * `src/lib/` would repeat the misfiling LAYERS.md §5.3 already records against
 * `imageOptimization.ts`. Keying on the tone `lib/` already emits keeps the domain layer
 * React-free while leaving one place to change an icon.
 *
 * The exhaustive `Record` is the guard — a new tone fails the typecheck here until a
 * glyph is chosen, so no status can reach the UI iconless.
 */
const ICON_BY_TONE: Record<PetStatusTone, LucideIcon> = {
  available: HeartHandshake,
  rehabilitation: Stethoscope,
  pending: Clock,
  adopted: HomeIcon,
};

interface PetStatusIconProps {
  tone: PetStatusTone;
  className?: string;
}

/**
 * Resolved at module scope rather than handed back as a component reference, so the
 * React Compiler's `static-components` rule can see the element type is stable.
 *
 * Always decorative: every call site pairs it with the translated status label, so
 * announcing it would make screen readers read the status twice.
 */
export function PetStatusIcon({ tone, className }: PetStatusIconProps) {
  const Icon = ICON_BY_TONE[tone];
  return <Icon className={className} aria-hidden="true" />;
}
