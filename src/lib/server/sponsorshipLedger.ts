import { prisma } from "@/lib/server/prisma";
import { isLedgerPersistent } from "@/lib/server/donationLedger";
import { Sen, senFromInteger } from "@/lib/domain/money";
import {
  DEFAULT_SPONSORSHIP_GOAL_SEN,
  PetSponsorshipSummary,
  SponsorshipAggregateRow,
  SponsorshipStatus,
  summarizePetSponsorships,
} from "@/lib/domain/petSponsorship";

/**
 * Repository for supporters' care commitments.
 *
 * ## Two declared modes, not a try/catch fallback
 *
 * The same contract `donationLedger.ts` documents, and `isLedgerPersistent()` is
 * imported from it rather than re-derived so the two can never disagree about
 * which mode the process is in:
 *
 * - `DATABASE_URL` set — Postgres is authoritative and a failed write
 *   propagates. A commitment that did not reach the database has not been made.
 * - `DATABASE_URL` unset — the in-memory ledger is authoritative. This is a
 *   deliberate configuration (local dev, unit tests), not a degraded database.
 *
 * The distinction matters here more than usual: reconciliation is what causes a
 * statutory receipt to be issued, so "the write may or may not have landed" is
 * not an acceptable third state.
 */

export interface SponsorshipRecord {
  id: string;
  petId: string | null;
  petName: string;
  sponsorName: string;
  sponsorEmail: string;
  sponsorPhone?: string;
  userId?: string | null;
  /** Sponsor Wall consent as given at this checkout. */
  displayOnWall?: boolean;
  tierId: string;
  tierName: string;
  frequency: "one_time" | "monthly";
  amountSen: Sen;
  paymentMethod: "duitnow_qr" | "online_banking" | "card";
  status: SponsorshipStatus;
  pledgeRef: string;
  receiptNumber?: string | null;
  /** ISO-8601 UTC. */
  createdAt: string;
  taxIdOrIc?: string;
  notes?: string;
}

export type SponsorshipDraft = Omit<
  SponsorshipRecord,
  "id" | "status" | "receiptNumber" | "createdAt"
>;

export class SponsorshipWriteError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SponsorshipWriteError";
    this.cause = cause;
  }
}

/** Postgres foreign key violation — the named pet has no row. */
const FK_VIOLATION = "P2003";

function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === FK_VIOLATION
  );
}

// ---------------------------------------------------------------- memory mode

let memorySponsorships: SponsorshipRecord[] = [];
let memorySerial = 0;

/** Test-only. Wired into the global `beforeEach` alongside the donation ledger. */
export function resetSponsorshipLedger(): void {
  memorySponsorships = [];
  memorySerial = 0;
}

/** Diagnostic read of the in-memory ledger. */
export function memorySponsorshipCount(): number {
  return memorySponsorships.length;
}

// --------------------------------------------------------------------- writes

/**
 * Records a commitment as `PENDING_PAYMENT`.
 *
 * Nothing here has verified that money moved, which is why this allocates a
 * pledge reference and never a receipt number.
 */
export async function recordSponsorshipPledge(
  draft: SponsorshipDraft,
  options?: { now?: Date }
): Promise<SponsorshipRecord> {
  const when = options?.now ?? new Date();

  if (!isLedgerPersistent()) {
    memorySerial += 1;
    const record: SponsorshipRecord = {
      ...draft,
      id: `mem-spn-${String(memorySerial).padStart(6, "0")}`,
      status: "PENDING_PAYMENT",
      receiptNumber: null,
      createdAt: when.toISOString(),
    };
    memorySponsorships = [record, ...memorySponsorships];
    return record;
  }

  const data = {
    petId: draft.petId,
    petName: draft.petName,
    sponsorName: draft.sponsorName,
    sponsorEmail: draft.sponsorEmail,
    sponsorPhone: draft.sponsorPhone ?? null,
    userId: draft.userId ?? null,
    tierId: draft.tierId,
    tierName: draft.tierName,
    frequency: draft.frequency,
    amountSen: draft.amountSen as number,
    paymentMethod: draft.paymentMethod,
    status: "PENDING_PAYMENT",
    pledgeRef: draft.pledgeRef,
    taxIdOrIc: draft.taxIdOrIc ?? null,
    notes: draft.notes ?? null,
    createdAt: when,
  };

  try {
    return toRecord(await prisma.petSponsorship.create({ data }));
  } catch (err) {
    // A pet served from the JSON fixture has no row to point at. The commitment
    // is still real and the snapshot still names the animal, so it is stored
    // unlinked rather than refused.
    if (isForeignKeyViolation(err) && draft.petId) {
      const unlinked = await prisma.petSponsorship.create({
        data: { ...data, petId: null },
      });
      return toRecord(unlinked);
    }
    throw new SponsorshipWriteError("Could not record the sponsorship", err);
  }
}

export type ReconcileOutcome =
  | { status: "reconciled"; record: SponsorshipRecord }
  | { status: "already_reconciled"; receiptNumber: string }
  | { status: "not_found" };

/**
 * Attaches an issued receipt number and moves the commitment to `ACTIVE`.
 *
 * In Postgres this is a single conditional UPDATE guarded on
 * `status = PENDING_PAYMENT`. Two coordinators — or two serverless instances —
 * racing on the same pledge therefore produce exactly one winner, and the loser
 * is told the number that already exists rather than issuing a second receipt
 * for the same money. Guarding on an in-process value instead would be no guard
 * at all: that value is empty on every other instance.
 */
export async function reconcileSponsorship(
  pledgeRef: string,
  receiptNumber: string,
  reconciledBy: string,
  options?: { now?: Date }
): Promise<ReconcileOutcome> {
  const when = options?.now ?? new Date();

  if (!isLedgerPersistent()) {
    const index = memorySponsorships.findIndex((row) => row.pledgeRef === pledgeRef);
    if (index < 0) return { status: "not_found" };

    const current = memorySponsorships[index];
    if (current.status === "ACTIVE" && current.receiptNumber) {
      return { status: "already_reconciled", receiptNumber: current.receiptNumber };
    }

    const record: SponsorshipRecord = { ...current, status: "ACTIVE", receiptNumber };
    memorySponsorships[index] = record;
    return { status: "reconciled", record };
  }

  const { count } = await prisma.petSponsorship.updateMany({
    where: { pledgeRef, status: "PENDING_PAYMENT" },
    data: { status: "ACTIVE", receiptNumber, reconciledAt: when, reconciledBy },
  });

  const row = await prisma.petSponsorship.findUnique({ where: { pledgeRef } });
  if (!row) return { status: "not_found" };

  if (count === 1) {
    return { status: "reconciled", record: toRecord(row) };
  }

  return row.receiptNumber
    ? { status: "already_reconciled", receiptNumber: row.receiptNumber }
    : { status: "not_found" };
}

// ---------------------------------------------------------------------- reads

/** Care-cost target for one animal, falling back to the shelter-wide default. */
export async function resolveGoalSen(petId: string): Promise<Sen> {
  if (!isLedgerPersistent()) return DEFAULT_SPONSORSHIP_GOAL_SEN;

  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: { sponsorshipGoalSen: true },
  });

  if (pet?.sponsorshipGoalSen && pet.sponsorshipGoalSen > 0) {
    return senFromInteger(pet.sponsorshipGoalSen);
  }

  const settings = await prisma.shelterSettings.findUnique({
    where: { id: "default-settings" },
    select: { defaultSponsorshipGoalSen: true },
  });

  return settings?.defaultSponsorshipGoalSen && settings.defaultSponsorshipGoalSen > 0
    ? senFromInteger(settings.defaultSponsorshipGoalSen)
    : DEFAULT_SPONSORSHIP_GOAL_SEN;
}

/** The public supporter count and funding total for one animal. */
export async function summarizeSponsorshipsForPet(
  petId: string
): Promise<PetSponsorshipSummary> {
  const goalSen = await resolveGoalSen(petId);

  if (!isLedgerPersistent()) {
    const rows: SponsorshipAggregateRow[] = memorySponsorships
      .filter((row) => row.petId === petId)
      .map((row) => ({
        sponsorEmail: row.sponsorEmail,
        amountSen: row.amountSen,
        status: row.status,
      }));
    return summarizePetSponsorships(petId, rows, goalSen);
  }

  // Only ACTIVE rows are read: a pending claim is not funding, and filtering in
  // the query keeps an unbounded pile of stale pledges off the wire.
  const rows = await prisma.petSponsorship.findMany({
    where: { petId, status: "ACTIVE" },
    select: { sponsorEmail: true, amountSen: true, status: true },
  });

  return summarizePetSponsorships(
    petId,
    rows.map((row) => ({
      sponsorEmail: row.sponsorEmail,
      amountSen: senFromInteger(row.amountSen),
      status: row.status as SponsorshipStatus,
    })),
    goalSen
  );
}

/** Looks a commitment up by the reference the supporter was given. */
export async function findSponsorshipByPledgeRef(
  pledgeRef: string
): Promise<SponsorshipRecord | null> {
  if (!isLedgerPersistent()) {
    return memorySponsorships.find((row) => row.pledgeRef === pledgeRef) ?? null;
  }

  const row = await prisma.petSponsorship.findUnique({ where: { pledgeRef } });
  return row ? toRecord(row) : null;
}

// ------------------------------------------------------- supporter-account reads
//
// The sponsor portal needs to see a supporter's own commitments. These live here
// rather than in `sponsorRepository.ts` because this module owns `pet_sponsorships`;
// a second module querying the same table is how two sources of truth start.

/** Every commitment claimed by a supporter account. */
export async function listSponsorshipsByUserId(
  userId: string
): Promise<SponsorshipRecord[]> {
  if (!isLedgerPersistent()) {
    return memorySponsorships.filter((row) => row.userId === userId);
  }

  const rows = await prisma.petSponsorship.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

/** Every commitment made under an email address, claimed or not. */
export async function listSponsorshipsByEmail(
  sponsorEmail: string
): Promise<SponsorshipRecord[]> {
  const normalised = sponsorEmail.trim().toLowerCase();

  if (!isLedgerPersistent()) {
    return memorySponsorships.filter(
      (row) => row.sponsorEmail.toLowerCase() === normalised
    );
  }

  const rows = await prisma.petSponsorship.findMany({
    where: { sponsorEmail: normalised },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

/**
 * Attaches every unclaimed commitment made under `sponsorEmail` to a supporter account.
 *
 * Guarded on `userId: null`, so a second claim cannot move a commitment that already
 * belongs to someone. Returns how many moved.
 */
export async function claimSponsorshipsForUser(
  userId: string,
  sponsorEmail: string
): Promise<number> {
  const normalised = sponsorEmail.trim().toLowerCase();

  if (!isLedgerPersistent()) {
    let claimed = 0;
    memorySponsorships = memorySponsorships.map((row) => {
      if (row.sponsorEmail.toLowerCase() === normalised && !row.userId) {
        claimed += 1;
        return { ...row, userId };
      }
      return row;
    });
    return claimed;
  }

  const { count } = await prisma.petSponsorship.updateMany({
    where: { sponsorEmail: normalised, userId: null },
    data: { userId },
  });
  return count;
}

/**
 * Cancels a supporter's own recurring commitment.
 *
 * Scoped to `userId` as well as `pledgeRef`, so a reference in a request cannot reach
 * another supporter's row, and guarded on `ACTIVE` so a cancelled commitment is not
 * cancelled twice.
 */
export async function cancelSponsorshipForUser(
  userId: string,
  pledgeRef: string,
  options?: { now?: Date }
): Promise<SponsorshipRecord | null> {
  const when = options?.now ?? new Date();

  if (!isLedgerPersistent()) {
    const index = memorySponsorships.findIndex(
      (row) =>
        row.pledgeRef === pledgeRef && row.userId === userId && row.status === "ACTIVE"
    );
    if (index < 0) return null;
    const record: SponsorshipRecord = {
      ...memorySponsorships[index],
      status: "CANCELLED",
    };
    memorySponsorships[index] = record;
    return record;
  }

  const { count } = await prisma.petSponsorship.updateMany({
    where: { pledgeRef, userId, status: "ACTIVE" },
    data: { status: "CANCELLED", cancelledAt: when },
  });
  if (count === 0) return null;

  const row = await prisma.petSponsorship.findUnique({ where: { pledgeRef } });
  return row ? toRecord(row) : null;
}

// ---------------------------------------------------------------------- shape

interface SponsorshipRow {
  id: string;
  petId: string | null;
  petName: string;
  sponsorName: string;
  sponsorEmail: string;
  sponsorPhone: string | null;
  userId: string | null;
  displayOnWall: boolean;
  tierId: string;
  tierName: string;
  frequency: string;
  amountSen: number;
  paymentMethod: string;
  status: string;
  pledgeRef: string;
  receiptNumber: string | null;
  taxIdOrIc: string | null;
  notes: string | null;
  createdAt: Date;
}

function toRecord(row: SponsorshipRow): SponsorshipRecord {
  return {
    id: row.id,
    petId: row.petId,
    petName: row.petName,
    sponsorName: row.sponsorName,
    sponsorEmail: row.sponsorEmail,
    sponsorPhone: row.sponsorPhone ?? undefined,
    userId: row.userId,
    displayOnWall: row.displayOnWall,
    tierId: row.tierId,
    tierName: row.tierName,
    frequency: row.frequency === "monthly" ? "monthly" : "one_time",
    amountSen: senFromInteger(row.amountSen),
    paymentMethod: row.paymentMethod as SponsorshipRecord["paymentMethod"],
    status: row.status as SponsorshipStatus,
    pledgeRef: row.pledgeRef,
    receiptNumber: row.receiptNumber,
    createdAt: row.createdAt.toISOString(),
    taxIdOrIc: row.taxIdOrIc ?? undefined,
    notes: row.notes ?? undefined,
  };
}
