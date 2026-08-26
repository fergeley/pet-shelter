import { CheckCircle2, Clock, FileText, XCircle, type LucideIcon } from "lucide-react";

import type { ApplicationStatusTone } from "@/lib/applicationStatusPresentation";

/**
 * The glyph that stands for each application status tone.
 *
 * Kept out of `@/lib/applicationStatusPresentation` for the same reason `PetStatusIcon`
 * is kept out of the pet one: that module is imported by `tests/unit/` under Vitest's
 * node environment, and pulling a React icon package into `src/lib/` would misfile it
 * across the layer boundary LAYERS.md §5.3 records.
 *
 * The exhaustive `Record` is the guard — a new tone fails the typecheck here until a
 * glyph is chosen.
 */
const ICON_BY_TONE: Record<ApplicationStatusTone, LucideIcon> = {
  submitted: FileText,
  underReview: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

interface ApplicationStatusIconProps {
  tone: ApplicationStatusTone;
  className?: string;
}

/**
 * Always decorative: every call site pairs it with the status label, so announcing it
 * would make screen readers read the status twice.
 */
export function ApplicationStatusIcon({ tone, className }: ApplicationStatusIconProps) {
  const Icon = ICON_BY_TONE[tone];
  return <Icon className={className} aria-hidden="true" />;
}
