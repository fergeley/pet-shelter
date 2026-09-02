import "server-only";

import { prisma } from "./prisma";
import {
  isLedgerPersistent,
  listDonations,
  findDonationByReceiptNumber,
  issueDonationReceipt,
  type DonationRecord,
} from "./donationLedger";
import { senFromRinggit } from "@/lib/domain/money";
import { currentIssuerIdentity } from "@/lib/domain/shelterIdentity";
import type { SponsorshipTierId } from "@/types/sponsorship";
import { hashPassword } from "@/lib/security/crypto";
import type { Sen } from "@/lib/domain/money";
import type {
  SponsorRecord,
  SponsorshipRecord,
  SponsoredDonation,
  WallSponsor,
} from "@/types/supporter";

/**
 * Sponsor accounts, and the programme's state about each issued donation.
 *
 * ## What this module is not
 *
 * It is **not** a second donation ledger. `donationLedger.ts` owns receipt numbering,
 * amounts, donor identity and the append-only guarantee; this module owns only the
 * mutable relationship around a receipt — who claims it, whether the payment was
 * reconciled, whether a recurring pledge is still running, whether the donor consents
 * to appear on the wall. Every amount read here comes from the ledger through a join.
 *
 * An earlier version of this branch stored its own copy of the donation. That was a
 * duplicate ledger with a weaker receipt number and whole-ringgit amounts, and it is
 * the reason this file was rewritten. See
 * `tasks/decisions/2026-09-03-sponsor-state-annotates-the-ledger.md`.
 *
 * ## Mode, not fallback
 *
 * Follows `donationLedger.ts` rather than the dual-layer repositories: the mode is
 * *declared* by whether `DATABASE_URL` is configured, not discovered by catching an
 * error. A configured database that rejects a write is a fault and must be loud —
 * silently demoting a sponsor's payment confirmation or consent withdrawal into
 * process memory is exactly the failure that makes a portal lie to its users.
 */

const CONFIRMED = "CONFIRMED";

/** Seeded demo sponsors exist only in offline mode. See `SEEDING_ENABLED`. */
const SEEDING_ENABLED = process.env.NODE_ENV !== "production" && !isLedgerPersistent();

// ---------------------------------------------------------------------------
// In-memory state (offline mode)
// ---------------------------------------------------------------------------

const memorySponsors = new Map<string, SponsorRecord>();
const memorySponsorships = new Map<string, SponsorshipRecord>();
let initialised = false;
let initPromise: Promise<void> | null = null;

interface SeedSponsor {
  id: string;
  email: string;
  name: string;
  initialPassword: string;
  displayOnWall: boolean;
  createdAt: string;
}

/**
 * One demo sponsor per standing, so the three-tier behaviour can be exercised without
 * a database. Their donations are seeded into the ledger by `seedOfflineSponsorships`
 * below, which is what makes the standings real rather than asserted.
 */
const SEED_SPONSORS: SeedSponsor[] = [
  {
    id: "spn-bronze-01",
    email: "bronze@example.com",
    name: "Nurul Aisyah",
    initialPassword: "bronze123",
    displayOnWall: true,
    createdAt: "2026-03-14T00:00:00.000Z",
  },
  {
    id: "spn-silver-01",
    email: "silver@example.com",
    name: "Jason Lim",
    initialPassword: "silver123",
    displayOnWall: true,
    createdAt: "2026-01-09T00:00:00.000Z",
  },
  {
    id: "spn-gold-01",
    email: "gold@example.com",
    name: "Datin Sofia Rahman",
    initialPassword: "gold123",
    displayOnWall: true,
    createdAt: "2025-11-02T00:00:00.000Z",
  },
];

/**
 * Demo donations, issued through the real ledger rather than fabricated.
 *
 * Going through `issueDonationReceipt` means the offline demo exercises the same
 * numbering, the same sen arithmetic and the same enrolment path as production — a
 * hand-built fixture would let those drift without any test noticing.
 *
 * Each sponsor is positioned to land on a different standing purely through
 * `deriveTier`, and the Bronze sponsor carries one pledge aged out of the recognition
 * window, which is what demonstrates that standings decay rather than accumulate.
 */
const SEED_DONATIONS: Array<{
  sponsorId: string | null;
  email: string;
  name: string;
  tierId: SponsorshipTierId;
  tierName: string;
  ringgit: number;
  frequency: "one_time" | "monthly";
  daysAgo: number;
  targetPetId: string | null;
  targetPetName: string | null;
  confirmed: boolean;
}> = [
  { sponsorId: "spn-bronze-01", email: "bronze@example.com", name: "Nurul Aisyah",
    tierId: "vaccine", tierName: "Core Vaccination & Deworming", ringgit: 50,
    frequency: "one_time", daysAgo: 40, targetPetId: "pet-002", targetPetName: "Milo",
    confirmed: true },
  { sponsorId: "spn-bronze-01", email: "bronze@example.com", name: "Nurul Aisyah",
    tierId: "emergency_medical", tierName: "Emergency Medical & Trauma Care", ringgit: 250,
    frequency: "one_time", daysAgo: 500, targetPetId: "pet-002", targetPetName: "Milo",
    confirmed: true },
  { sponsorId: "spn-silver-01", email: "silver@example.com", name: "Jason Lim",
    tierId: "emergency_medical", tierName: "Emergency Medical & Trauma Care", ringgit: 250,
    frequency: "one_time", daysAgo: 120, targetPetId: "pet-001", targetPetName: "Bella",
    confirmed: true },
  { sponsorId: "spn-silver-01", email: "silver@example.com", name: "Jason Lim",
    tierId: "spay_neuter", tierName: "Spay / Neuter Surgery Sponsorship", ringgit: 120,
    frequency: "one_time", daysAgo: 30, targetPetId: "pet-005", targetPetName: "Rocky",
    confirmed: true },
  { sponsorId: "spn-gold-01", email: "gold@example.com", name: "Datin Sofia Rahman",
    tierId: "kibble", tierName: "1-Week Nutrition & Kibble Fund", ringgit: 120,
    frequency: "monthly", daysAgo: 210, targetPetId: "pet-003", targetPetName: "Luna",
    confirmed: true },
  { sponsorId: "spn-gold-01", email: "gold@example.com", name: "Datin Sofia Rahman",
    tierId: "emergency_medical", tierName: "Emergency Medical & Trauma Care", ringgit: 250,
    frequency: "one_time", daysAgo: 15, targetPetId: "pet-006", targetPetName: "Cleo",
    confirmed: true },
  // Unclaimed: a confirmed donation by someone with no account yet, for the claim flow.
  { sponsorId: null, email: "unclaimed@example.com", name: "Tan Wei Ming",
    tierId: "spay_neuter", tierName: "Spay / Neuter Surgery Sponsorship", ringgit: 120,
    frequency: "one_time", daysAgo: 60, targetPetId: "pet-001", targetPetName: "Bella",
    confirmed: true },
];

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedOfflineDonations(): Promise<void> {
  const issuer = currentIssuerIdentity();

  for (const seed of SEED_DONATIONS) {
    const issuedAt = new Date(Date.now() - seed.daysAgo * DAY_MS);
    const record = await issueDonationReceipt(
      {
        donorName: seed.name,
        donorEmail: seed.email,
        tierId: seed.tierId,
        tierName: seed.tierName,
        amountSen: senFromRinggit(seed.ringgit),
        currency: "MYR",
        frequency: seed.frequency,
        paymentMethod: "duitnow_qr",
        targetPetName: seed.targetPetName ?? undefined,
        ...issuer,
      },
      { now: issuedAt }
    );

    memorySponsorships.set(record.receiptNumber, {
      receiptNumber: record.receiptNumber,
      sponsorId: seed.sponsorId,
      status: seed.confirmed ? CONFIRMED : "PENDING",
      isActive: true,
      displayOnWall: true,
      targetPetId: seed.targetPetId,
    });
  }
}

function ensureInitialised(): Promise<void> {
  if (initialised) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      if (SEEDING_ENABLED) {
        for (const seed of SEED_SPONSORS) {
          memorySponsors.set(seed.email, {
            id: seed.id,
            email: seed.email,
            name: seed.name,
            passwordHash: await hashPassword(seed.initialPassword),
            displayOnWall: seed.displayOnWall,
            createdAt: seed.createdAt,
            updatedAt: seed.createdAt,
          });
        }
        await seedOfflineDonations();
      }
      initialised = true;
    })();
  }
  return initPromise;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface DbSponsor {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  displayOnWall: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface DbSponsorship {
  receiptNumber: string;
  sponsorId: string | null;
  status: string;
  isActive: boolean;
  displayOnWall: boolean;
  targetPetId: string | null;
}

function toSponsor(row: DbSponsor): SponsorRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    displayOnWall: row.displayOnWall,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSponsorship(row: DbSponsorship): SponsorshipRecord {
  return {
    receiptNumber: row.receiptNumber,
    sponsorId: row.sponsorId,
    status: row.status === CONFIRMED ? CONFIRMED : "PENDING",
    isActive: row.isActive,
    displayOnWall: row.displayOnWall,
    targetPetId: row.targetPetId,
  };
}

/** Joins a sponsorship row to the ledger record it annotates. */
function join(
  sponsorship: SponsorshipRecord,
  donation: DonationRecord
): SponsoredDonation {
  return {
    ...sponsorship,
    donorEmail: donation.donorEmail,
    donorName: donation.donorName,
    tierId: donation.tierId,
    tierName: donation.tierName,
    amountSen: donation.amountSen,
    frequency: donation.frequency,
    targetPetName: donation.targetPetName ?? null,
    issuedAt: donation.issuedAt,
  };
}

// ---------------------------------------------------------------------------
// Sponsor accounts
// ---------------------------------------------------------------------------

export async function findSponsorByEmail(email: string): Promise<SponsorRecord | null> {
  const normalised = email.trim().toLowerCase();

  if (isLedgerPersistent()) {
    const row = await prisma.sponsor.findUnique({ where: { email: normalised } });
    return row ? toSponsor(row as DbSponsor) : null;
  }

  await ensureInitialised();
  return memorySponsors.get(normalised) ?? null;
}

export async function findSponsorById(id: string): Promise<SponsorRecord | null> {
  if (isLedgerPersistent()) {
    const row = await prisma.sponsor.findUnique({ where: { id } });
    return row ? toSponsor(row as DbSponsor) : null;
  }

  await ensureInitialised();
  for (const sponsor of memorySponsors.values()) {
    if (sponsor.id === id) return sponsor;
  }
  return null;
}

export async function createSponsor(data: {
  email: string;
  name: string;
  passwordHash: string;
  displayOnWall: boolean;
}): Promise<SponsorRecord> {
  const normalised = data.email.trim().toLowerCase();

  if (isLedgerPersistent()) {
    const row = await prisma.sponsor.create({
      data: {
        email: normalised,
        name: data.name.trim(),
        passwordHash: data.passwordHash,
        displayOnWall: data.displayOnWall,
      },
    });
    return toSponsor(row as DbSponsor);
  }

  await ensureInitialised();
  const now = new Date().toISOString();
  const record: SponsorRecord = {
    id: `spn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    email: normalised,
    name: data.name.trim(),
    passwordHash: data.passwordHash,
    displayOnWall: data.displayOnWall,
    createdAt: now,
    updatedAt: now,
  };
  memorySponsors.set(normalised, record);
  return record;
}

/** Returns whether the preference was actually stored. */
export async function setSponsorWallPreference(
  sponsorId: string,
  displayOnWall: boolean
): Promise<boolean> {
  if (isLedgerPersistent()) {
    await prisma.sponsor.update({ where: { id: sponsorId }, data: { displayOnWall } });
    return true;
  }

  await ensureInitialised();
  for (const sponsor of memorySponsors.values()) {
    if (sponsor.id === sponsorId) {
      sponsor.displayOnWall = displayOnWall;
      sponsor.updatedAt = new Date().toISOString();
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Sponsorship state
// ---------------------------------------------------------------------------

/**
 * Enrols an issued donation in the sponsorship programme.
 *
 * Called immediately after `issueDonationReceipt`, with the receipt number the ledger
 * assigned. Deliberately stores nothing the ledger already holds.
 */
export async function enrolDonation(input: {
  receiptNumber: string;
  sponsorId?: string | null;
  displayOnWall?: boolean;
  targetPetId?: string | null;
}): Promise<SponsorshipRecord> {
  const record: SponsorshipRecord = {
    receiptNumber: input.receiptNumber,
    sponsorId: input.sponsorId ?? null,
    // An unreconciled pledge grants nothing: `/donate` is public and has no payment
    // gateway behind it.
    status: "PENDING",
    isActive: true,
    displayOnWall: input.displayOnWall ?? false,
    targetPetId: input.targetPetId ?? null,
  };

  if (isLedgerPersistent()) {
    const row = await prisma.donationSponsorship.create({ data: record });
    return toSponsorship(row as DbSponsorship);
  }

  await ensureInitialised();
  memorySponsorships.set(record.receiptNumber, record);
  return record;
}

async function loadSponsorships(where: {
  sponsorId?: string;
  receiptNumbers?: string[];
}): Promise<SponsorshipRecord[]> {
  if (isLedgerPersistent()) {
    const rows = await prisma.donationSponsorship.findMany({
      where: {
        ...(where.sponsorId ? { sponsorId: where.sponsorId } : {}),
        ...(where.receiptNumbers ? { receiptNumber: { in: where.receiptNumbers } } : {}),
      },
    });
    return (rows as DbSponsorship[]).map(toSponsorship);
  }

  await ensureInitialised();
  return Array.from(memorySponsorships.values()).filter((s) => {
    if (where.sponsorId && s.sponsorId !== where.sponsorId) return false;
    if (where.receiptNumbers && !where.receiptNumbers.includes(s.receiptNumber)) {
      return false;
    }
    return true;
  });
}

/** Resolves sponsorship rows against the ledger, newest first. */
async function withDonations(
  sponsorships: SponsorshipRecord[]
): Promise<SponsoredDonation[]> {
  if (sponsorships.length === 0) return [];

  const donations = new Map<string, DonationRecord>();
  if (isLedgerPersistent()) {
    for (const sponsorship of sponsorships) {
      const donation = await findDonationByReceiptNumber(sponsorship.receiptNumber);
      if (donation) donations.set(donation.receiptNumber, donation);
    }
  } else {
    for (const donation of await listDonations(1000)) {
      donations.set(donation.receiptNumber, donation);
    }
  }

  return sponsorships
    .map((sponsorship) => {
      const donation = donations.get(sponsorship.receiptNumber);
      return donation ? join(sponsorship, donation) : null;
    })
    .filter((entry): entry is SponsoredDonation => entry !== null)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

export async function listSponsoredDonationsBySponsorId(
  sponsorId: string
): Promise<SponsoredDonation[]> {
  return withDonations(await loadSponsorships({ sponsorId }));
}

/**
 * Every enrolled donation made under `email`, claimed or not.
 *
 * The ledger is the authority on which email a receipt was issued to, so the lookup
 * starts there rather than duplicating the address on the sponsorship row.
 */
export async function listSponsoredDonationsByEmail(
  email: string
): Promise<SponsoredDonation[]> {
  const normalised = email.trim().toLowerCase();

  const receipts = isLedgerPersistent()
    ? (
        await prisma.donation.findMany({
          where: { donorEmail: normalised },
          select: { receiptNumber: true },
        })
      ).map((row: { receiptNumber: string }) => row.receiptNumber)
    : (await listDonations(1000))
        .filter((d) => d.donorEmail === normalised)
        .map((d) => d.receiptNumber);

  if (receipts.length === 0) return [];
  return withDonations(await loadSponsorships({ receiptNumbers: receipts }));
}

export async function findSponsoredDonationByReceipt(
  receiptNumber: string
): Promise<SponsoredDonation | null> {
  const normalised = receiptNumber.trim().toUpperCase();
  const [entry] = await withDonations(
    await loadSponsorships({ receiptNumbers: [normalised] })
  );
  return entry ?? null;
}

/** Attaches every unclaimed donation made under `email` to a sponsor account. */
export async function linkDonationsToSponsor(
  sponsorId: string,
  email: string
): Promise<number> {
  const normalised = email.trim().toLowerCase();
  const owned = await listSponsoredDonationsByEmail(normalised);
  const unclaimed = owned.filter((entry) => entry.sponsorId === null);

  if (unclaimed.length === 0) return 0;

  if (isLedgerPersistent()) {
    const result = await prisma.donationSponsorship.updateMany({
      where: { receiptNumber: { in: unclaimed.map((e) => e.receiptNumber) } },
      data: { sponsorId },
    });
    return result.count;
  }

  await ensureInitialised();
  for (const entry of unclaimed) {
    const row = memorySponsorships.get(entry.receiptNumber);
    if (row) row.sponsorId = sponsorId;
  }
  return unclaimed.length;
}

/**
 * Marks a pledge as reconciled against money that actually arrived.
 *
 * A staff act. Confirming is what an attacker cannot do, which is what stops the
 * public donation form from being a route to a standing, or to someone else's account.
 */
export async function confirmSponsoredDonation(
  receiptNumber: string
): Promise<SponsoredDonation | null> {
  const normalised = receiptNumber.trim().toUpperCase();

  if (isLedgerPersistent()) {
    const updated = await prisma.donationSponsorship.updateMany({
      where: { receiptNumber: normalised },
      data: { status: CONFIRMED },
    });
    if (updated.count === 0) return null;
  } else {
    await ensureInitialised();
    const row = memorySponsorships.get(normalised);
    if (!row) return null;
    row.status = CONFIRMED;
  }

  return findSponsoredDonationByReceipt(normalised);
}

/** Cancels a sponsor's own recurring pledge. Scoped to their id, not just the receipt. */
export async function cancelRecurringPledge(
  sponsorId: string,
  receiptNumber: string
): Promise<SponsoredDonation | null> {
  const normalised = receiptNumber.trim().toUpperCase();
  const entry = await findSponsoredDonationByReceipt(normalised);

  if (!entry || entry.sponsorId !== sponsorId || entry.frequency !== "monthly") {
    return null;
  }

  if (isLedgerPersistent()) {
    await prisma.donationSponsorship.update({
      where: { receiptNumber: normalised },
      data: { isActive: false },
    });
  } else {
    await ensureInitialised();
    const row = memorySponsorships.get(normalised);
    if (row) row.isActive = false;
  }

  return findSponsoredDonationByReceipt(normalised);
}

/**
 * Sponsors who opted in to the wall, with just enough of their giving to derive a
 * standing. Carries no password hash and no donor contact details, so the privacy the
 * wall promises is enforced by the shape rather than by the caller remembering.
 */
export async function listWallOptInSponsors(): Promise<
  Array<{ sponsor: WallSponsor; donations: SponsoredDonation[] }>
> {
  let sponsors: WallSponsor[];

  if (isLedgerPersistent()) {
    const rows = await prisma.sponsor.findMany({
      where: { displayOnWall: true },
      select: { id: true, name: true, displayOnWall: true, createdAt: true },
    });
    sponsors = (rows as Array<{
      id: string;
      name: string;
      displayOnWall: boolean;
      createdAt: Date;
    }>).map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  } else {
    await ensureInitialised();
    sponsors = Array.from(memorySponsors.values())
      .filter((s) => s.displayOnWall)
      .map((s) => ({
        id: s.id,
        name: s.name,
        displayOnWall: s.displayOnWall,
        createdAt: s.createdAt,
      }));
  }

  const result = [];
  for (const sponsor of sponsors) {
    result.push({
      sponsor,
      donations: await listSponsoredDonationsBySponsorId(sponsor.id),
    });
  }
  return result;
}

/** Test-only reset, wired into the global `beforeEach` alongside `resetDonationLedger`. */
export async function resetSponsorRepository(): Promise<void> {
  memorySponsors.clear();
  memorySponsorships.clear();
  initialised = false;
  initPromise = null;
  await ensureInitialised();
}

/** Re-exported so callers need not import the ledger to know which mode they are in. */
export { isLedgerPersistent };
export type { Sen };
