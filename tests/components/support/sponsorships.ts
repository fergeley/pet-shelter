import type { PendingSponsorshipDTO } from "@/actions/sponsorships";

/**
 * Tier-4 fixture for the coordinator's reconciliation queue.
 *
 * `import type` only, so this file does **not** pull the real
 * `@/actions/sponsorships` — and through it Prisma — into jsdom. The annotation
 * is erased at compile time, which is what lets a suite mock that module
 * wholesale and still describe its rows precisely.
 *
 * Every field the DTO declares is populated, including the two optional ones,
 * so a test states only the field it is actually about. `amountDisplay` and
 * `paymentMethodLabel` are preformatted by the action for the reason its own
 * comments give: the table must not re-derive the ledger's rounding or invent a
 * rail name. The defaults keep them *distinguishable* from `amountSen` and
 * `paymentMethod`, so a table rendering the raw field cannot pass by accident.
 */
let pledgeCounter = 0;

export function makePendingSponsorship(
  overrides: Partial<PendingSponsorshipDTO> = {}
): PendingSponsorshipDTO {
  pledgeCounter += 1;
  return {
    pledgeRef: `SPN-2026-${String(pledgeCounter).padStart(4, "0")}`,
    petName: "Bella",
    sponsorName: "Aisyah Rahman",
    sponsorEmail: "aisyah@example.com",
    sponsorPhone: "012-345 6789",
    tierName: "Core Vaccination & Deworming",
    frequency: "monthly",
    amountSen: 8000,
    amountDisplay: "RM 80.00",
    paymentMethod: "duitnow_qr",
    paymentMethodLabel: "DuitNow QR",
    notes: "Transferred from Maybank on the 2nd",
    // 01:00 on 3 Sep in Kuala Lumpur, which is still 2 Sep in UTC — the
    // eight-hour window the component's `pledgedOn` comment is about.
    createdAt: "2026-09-02T17:00:00.000Z",
    ...overrides,
  };
}
