/**
 * Single source of truth for the shelter's statutory identifiers.
 *
 * ## Why this file exists
 *
 * These identifiers were previously hardcoded in at least six places
 * (`src/actions/donations.ts`, `src/lib/exportCsv.ts` twice, `SponsorshipModal.tsx`,
 * `Footer.tsx`, `HomeSections.tsx`, the donate/terms/privacy pages, and the i18n
 * dictionary). Two digit-transposed variants of the ROS registration number drifted
 * apart across those copies, and the variant that reaches **LHDN Section 44(6) tax
 * e-receipts and ROS CSV exports** is not the one shown to the public.
 *
 * That is P2 in `docs/tasks/HANDOFF_SECURITY_REHAB_AND_HISTORY.md`, and it is
 * explicitly **blocked on a stakeholder checking the physical ROS certificate**.
 * This module therefore does *not* resolve which value is correct — guessing on a
 * statutory identifier is worse than leaving it visibly unresolved. What it does is
 * reduce the blast radius of the eventual fix from "edit six files, hope you found
 * them all" to "delete one constant here".
 *
 * ### How to close P2
 *
 * Once the certificate is confirmed, set {@link STATUTORY_ROS_REGISTRATION_NO} and
 * {@link PUBLIC_ROS_REGISTRATION_NO} to the same value and collapse them into one
 * export. `tests/unit/shelterIdentity.test.ts` asserts the divergence is still
 * deliberate, so it will fail and point at this comment when they are unified —
 * delete that assertion as part of the same change.
 *
 * Historical receipts are unaffected either way: `Donation` rows snapshot the
 * identifiers they were issued under (see `prisma/schema.prisma`), exactly as an
 * invoice records the tax number in force on its issue date. Correcting the
 * constant changes future receipts only, which is the legally correct behaviour.
 */

/**
 * LHDN approval reference for Subsection 44(6) tax-deductible status.
 * Consistent everywhere it appears; no known dispute.
 */
export const LHDN_TAX_DEDUCTIBLE_REF = "LHDN.01/35/42/51/179-6.4912";

/**
 * ROS registration number as it currently appears on **issued tax receipts and
 * ROS exports**. Overridable without a code deploy so the stakeholder fix can ship
 * as a configuration change.
 *
 * Preserved byte-for-byte from `src/actions/donations.ts` so that centralising the
 * constant changes no output. See the P2 note above before "correcting" it.
 *
 * **The override reaches server code only.** `SponsorshipModal` and `sponsorshipStore`
 * are `"use client"`, and Next.js inlines only `NEXT_PUBLIC_*` into the client bundle, so
 * `process.env.ROS_REGISTRATION_NO` is `undefined` there and the default below applies.
 * Correcting P2 by configuration therefore fixes server-issued receipts and ROS exports;
 * the client-side sponsorship receipt needs the constant itself edited. Renaming this to
 * `NEXT_PUBLIC_ROS_REGISTRATION_NO` would close that gap if the config path matters more
 * than keeping a statutory identifier out of the browser bundle.
 */
export const STATUTORY_ROS_REGISTRATION_NO =
  process.env.ROS_REGISTRATION_NO ?? "PPM-021-10-18082021";

/**
 * ROS registration number as shown in public-facing copy — footer, donate page,
 * privacy, terms, README. Matches the value documented as canonical in CLAUDE.md.
 *
 * Diverges from {@link STATUTORY_ROS_REGISTRATION_NO} pending P2. Do not "fix" the
 * mismatch by aligning one to the other without the certificate.
 */
export const PUBLIC_ROS_REGISTRATION_NO = "PPM-012-10-18042016";

/** Registered society name, as filed with the Registry of Societies. */
export const SHELTER_LEGAL_NAME = "Persatuan Harapan Haiwan Terbiar Selangor";

/**
 * The identifiers stamped onto a receipt at the moment it is issued.
 *
 * Returned as a snapshot rather than read live at render time so that a receipt
 * reprinted years later shows what it was issued under, not what the constants say
 * today.
 */
export interface StatutoryIssuerIdentity {
  taxDeductibleRef: string;
  shelterRegistrationNo: string;
}

/** Captures the issuer identity in force right now. */
export function currentIssuerIdentity(): StatutoryIssuerIdentity {
  return {
    taxDeductibleRef: LHDN_TAX_DEDUCTIBLE_REF,
    shelterRegistrationNo: STATUTORY_ROS_REGISTRATION_NO,
  };
}
