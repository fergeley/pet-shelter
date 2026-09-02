import "server-only";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/crypto";
import { SponsorRecord, SponsorContributionRecord } from "@/types/supporter";
import { SponsorshipTierId } from "@/types/sponsorship";

/**
 * Data access layer for sponsor accounts and their contribution ledger.
 *
 * Marked `server-only`: nothing here may be imported into a Client Component. Password
 * hashes and other donors' contribution rows live in this module, and the tier gates in
 * `@/lib/domain/sponsorAccess` read from it, so shipping it to the browser would defeat
 * every gate in the feature.
 *
 * Follows the Prisma-first / memory-fallback shape already used by `userStore` and
 * `serverStore`, so the sponsor portal is demonstrable and testable on a machine with no
 * Postgres running.
 */

/**
 * One place to report that a query fell back to memory.
 *
 * The `catch` blocks below were silent, which made the two failure modes
 * indistinguishable in a log: a database that is down, and a database that is fine but
 * whose write was rejected. Matches the `[Database Store]` notices in `serverStore`.
 */
function warnDatabaseFallback(operation: string, err: unknown): void {
  console.warn(
    `[Sponsor Store] ${operation} falling back to memory:`,
    err instanceof Error ? err.message : err
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

interface SeedSponsor {
  id: string;
  email: string;
  name: string;
  initialPassword: string;
  displayOnWall: boolean;
  createdAt: string;
  contributions: Array<
    Omit<SponsorContributionRecord, "sponsorId" | "donorEmail" | "donorName">
  >;
}

/**
 * Demo sponsors used when no database is reachable. Each one is positioned to land on a
 * different standing purely through `deriveTier`, so the three-tier verification the brief
 * asks for can actually be run.
 */
const SEED_SPONSORS: SeedSponsor[] = [
  {
    id: "spn-bronze-01",
    email: "bronze@example.com",
    name: "Nurul Aisyah",
    initialPassword: "bronze123",
    displayOnWall: true,
    createdAt: "2026-03-14T00:00:00.000Z",
    contributions: [
      {
        id: "con-bronze-01",
        receiptNumber: "HFS-DON-202603-1041",
        tierId: "vaccine",
        tierName: "Core Vaccination & Deworming",
        amountMYR: 50,
        frequency: "one_time",
        isActive: true,
        displayOnWall: true,
        targetPetId: "pet-002",
        targetPetName: "Milo",
        createdAt: daysAgo(40),
      },
      {
        // Aged past the 365-day recognition window: proves standings decay.
        id: "con-bronze-02",
        receiptNumber: "HFS-DON-202501-8890",
        tierId: "emergency_medical",
        tierName: "Emergency Medical & Trauma Care",
        amountMYR: 250,
        frequency: "one_time",
        isActive: true,
        displayOnWall: true,
        targetPetId: "pet-002",
        targetPetName: "Milo",
        createdAt: daysAgo(500),
      },
    ],
  },
  {
    id: "spn-silver-01",
    email: "silver@example.com",
    name: "Jason Lim",
    initialPassword: "silver123",
    displayOnWall: true,
    createdAt: "2026-01-09T00:00:00.000Z",
    contributions: [
      {
        id: "con-silver-01",
        receiptNumber: "HFS-DON-202601-2277",
        tierId: "emergency_medical",
        tierName: "Emergency Medical & Trauma Care",
        amountMYR: 250,
        frequency: "one_time",
        isActive: true,
        displayOnWall: true,
        targetPetId: "pet-001",
        targetPetName: "Bella",
        createdAt: daysAgo(120),
      },
      {
        id: "con-silver-02",
        receiptNumber: "HFS-DON-202604-3319",
        tierId: "spay_neuter",
        tierName: "Spay / Neuter Surgery Sponsorship",
        amountMYR: 120,
        frequency: "one_time",
        isActive: true,
        displayOnWall: true,
        targetPetId: "pet-005",
        targetPetName: "Rocky",
        createdAt: daysAgo(30),
      },
    ],
  },
  {
    id: "spn-gold-01",
    email: "gold@example.com",
    name: "Datin Sofia Rahman",
    initialPassword: "gold123",
    displayOnWall: true,
    createdAt: "2025-11-02T00:00:00.000Z",
    contributions: [
      {
        id: "con-gold-01",
        receiptNumber: "HFS-DON-202511-5512",
        tierId: "kibble",
        tierName: "1-Week Nutrition & Kibble Fund",
        amountMYR: 120,
        frequency: "monthly",
        isActive: true,
        displayOnWall: true,
        targetPetId: "pet-003",
        targetPetName: "Luna",
        createdAt: daysAgo(210),
      },
      {
        id: "con-gold-02",
        receiptNumber: "HFS-DON-202605-7734",
        tierId: "emergency_medical",
        tierName: "Emergency Medical & Trauma Care",
        amountMYR: 250,
        frequency: "one_time",
        isActive: true,
        displayOnWall: true,
        targetPetId: "pet-006",
        targetPetName: "Cleo",
        createdAt: daysAgo(15),
      },
    ],
  },
];

/**
 * Pledges made by donors who have not yet claimed a portal account.
 *
 * This is the normal case, not an edge case: donation is a public form, so almost every
 * contribution starts life unattached and is claimed later by proving possession of its
 * receipt number. Seeding one makes that path demonstrable and testable.
 */
const SEED_UNCLAIMED_CONTRIBUTIONS: SponsorContributionRecord[] = [
  {
    id: "con-unclaimed-01",
    sponsorId: null,
    receiptNumber: "HFS-DON-202607-6600",
    donorEmail: "unclaimed@example.com",
    donorName: "Tan Wei Ming",
    tierId: "spay_neuter",
    tierName: "Spay / Neuter Surgery Sponsorship",
    amountMYR: 120,
    frequency: "one_time",
    isActive: true,
    displayOnWall: true,
    targetPetId: "pet-001",
    targetPetName: "Bella",
    createdAt: daysAgo(60),
  },
];

const sponsorsByEmail: Map<string, SponsorRecord> = new Map();
const contributions: SponsorContributionRecord[] = [];
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Whether demo sponsors may exist at all.
 *
 * The seed's purpose is to make the portal demonstrable with no database — which is a
 * development purpose, and this repo has never run the sponsor tables against Postgres.
 * In production the same seed is an authentication bypass: a database miss for
 * `gold@example.com` would otherwise fall through to a seeded account whose password is
 * published in `docs/architecture/GUIDE_SPONSOR_TIERS_AND_GATED_CONTENT.md`.
 *
 * So the fallback stays and the credentials do not. With no seed, a production instance
 * whose database is unreachable fails closed: no sponsor resolves, nothing unlocks.
 */
const SEEDING_ENABLED = process.env.NODE_ENV !== "production";

function ensureInitialized(): Promise<void> {
  if (isInitialized) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      if (!SEEDING_ENABLED) {
        isInitialized = true;
        return;
      }
      for (const seed of SEED_SPONSORS) {
        const passwordHash = await hashPassword(seed.initialPassword);
        const email = seed.email.toLowerCase();
        sponsorsByEmail.set(email, {
          id: seed.id,
          email,
          name: seed.name,
          passwordHash,
          displayOnWall: seed.displayOnWall,
          createdAt: seed.createdAt,
          updatedAt: seed.createdAt,
        });
        for (const contribution of seed.contributions) {
          contributions.push({
            ...contribution,
            sponsorId: seed.id,
            donorEmail: email,
            donorName: seed.name,
          });
        }
      }
      contributions.push(...SEED_UNCLAIMED_CONTRIBUTIONS.map((c) => ({ ...c })));
      isInitialized = true;
    })();
  }
  return initPromise;
}

interface DbSponsor {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  displayOnWall: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface DbContribution {
  id: string;
  sponsorId: string | null;
  receiptNumber: string;
  donorEmail: string;
  donorName: string;
  tierId: string;
  tierName: string;
  amountMYR: number;
  frequency: string;
  isActive: boolean;
  displayOnWall: boolean;
  targetPetId: string | null;
  targetPetName: string | null;
  createdAt: Date;
}

function toSponsorRecord(row: DbSponsor): SponsorRecord {
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

function toContributionRecord(row: DbContribution): SponsorContributionRecord {
  return {
    id: row.id,
    sponsorId: row.sponsorId,
    receiptNumber: row.receiptNumber,
    donorEmail: row.donorEmail,
    donorName: row.donorName,
    tierId: row.tierId as SponsorshipTierId,
    tierName: row.tierName,
    amountMYR: row.amountMYR,
    frequency: row.frequency === "monthly" ? "monthly" : "one_time",
    isActive: row.isActive,
    displayOnWall: row.displayOnWall,
    targetPetId: row.targetPetId,
    targetPetName: row.targetPetName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findSponsorByEmail(email: string): Promise<SponsorRecord | null> {
  const normalized = email.trim().toLowerCase();
  try {
    const row = await prisma.sponsor.findUnique({ where: { email: normalized } });
    return row ? toSponsorRecord(row as DbSponsor) : null;
  } catch (err) {
    warnDatabaseFallback("findSponsorByEmail", err);
  }

  await ensureInitialized();
  return sponsorsByEmail.get(normalized) ?? null;
}

export async function findSponsorById(id: string): Promise<SponsorRecord | null> {
  try {
    const row = await prisma.sponsor.findUnique({ where: { id } });
    return row ? toSponsorRecord(row as DbSponsor) : null;
  } catch (err) {
    warnDatabaseFallback("findSponsorById", err);
  }

  await ensureInitialized();
  for (const sponsor of sponsorsByEmail.values()) {
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
  const normalized = data.email.trim().toLowerCase();
  const existing = await findSponsorByEmail(normalized);
  if (existing) {
    throw new Error(`A sponsor account for '${normalized}' already exists.`);
  }

  const now = new Date().toISOString();
  const record: SponsorRecord = {
    id: `spn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    email: normalized,
    name: data.name.trim(),
    passwordHash: data.passwordHash,
    displayOnWall: data.displayOnWall,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const row = await prisma.sponsor.create({
      data: {
        email: record.email,
        name: record.name,
        passwordHash: record.passwordHash,
        displayOnWall: record.displayOnWall,
      },
    });
    const created = toSponsorRecord(row as DbSponsor);
    await ensureInitialized();
    sponsorsByEmail.set(created.email, created);
    return created;
  } catch (err) {
    warnDatabaseFallback("createSponsor", err);
    await ensureInitialized();
    sponsorsByEmail.set(record.email, record);
    return record;
  }
}

export async function setSponsorWallPreference(
  sponsorId: string,
  displayOnWall: boolean
): Promise<void> {
  try {
    await prisma.sponsor.update({
      where: { id: sponsorId },
      data: { displayOnWall },
    });
  } catch (err) {
    warnDatabaseFallback("setSponsorWallPreference", err);
  }

  await ensureInitialized();
  for (const sponsor of sponsorsByEmail.values()) {
    if (sponsor.id === sponsorId) {
      sponsor.displayOnWall = displayOnWall;
      sponsor.updatedAt = new Date().toISOString();
    }
  }
}

export async function listContributionsBySponsorId(
  sponsorId: string
): Promise<SponsorContributionRecord[]> {
  try {
    const rows = await prisma.sponsorContribution.findMany({
      where: { sponsorId },
      orderBy: { createdAt: "desc" },
    });
    return (rows as DbContribution[]).map(toContributionRecord);
  } catch (err) {
    warnDatabaseFallback("listContributionsBySponsorId", err);
  }

  await ensureInitialized();
  return contributions
    .filter((c) => c.sponsorId === sponsorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listContributionsByEmail(
  email: string
): Promise<SponsorContributionRecord[]> {
  const normalized = email.trim().toLowerCase();
  try {
    const rows = await prisma.sponsorContribution.findMany({
      where: { donorEmail: normalized },
      orderBy: { createdAt: "desc" },
    });
    return (rows as DbContribution[]).map(toContributionRecord);
  } catch (err) {
    warnDatabaseFallback("listContributionsByEmail", err);
  }

  await ensureInitialized();
  return contributions
    .filter((c) => c.donorEmail === normalized)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findContributionByReceipt(
  receiptNumber: string
): Promise<SponsorContributionRecord | null> {
  const normalized = receiptNumber.trim().toUpperCase();
  try {
    const row = await prisma.sponsorContribution.findUnique({
      where: { receiptNumber: normalized },
    });
    return row ? toContributionRecord(row as DbContribution) : null;
  } catch (err) {
    warnDatabaseFallback("findContributionByReceipt", err);
  }

  await ensureInitialized();
  return contributions.find((c) => c.receiptNumber === normalized) ?? null;
}

/**
 * Attaches every historical contribution made under `email` to a sponsor account.
 * Called once, at registration, after the receipt-number challenge has been satisfied.
 */
export async function linkContributionsToSponsor(
  sponsorId: string,
  email: string
): Promise<number> {
  const normalized = email.trim().toLowerCase();
  try {
    const result = await prisma.sponsorContribution.updateMany({
      where: { donorEmail: normalized, sponsorId: null },
      data: { sponsorId },
    });
    return result.count;
  } catch (err) {
    warnDatabaseFallback("linkContributionsToSponsor", err);
  }

  await ensureInitialized();
  let linked = 0;
  for (const contribution of contributions) {
    if (contribution.donorEmail === normalized && contribution.sponsorId === null) {
      contribution.sponsorId = sponsorId;
      linked += 1;
    }
  }
  return linked;
}

export async function recordContribution(input: {
  receiptNumber: string;
  donorEmail: string;
  donorName: string;
  tierId: SponsorshipTierId;
  tierName: string;
  amountMYR: number;
  frequency: "one_time" | "monthly";
  displayOnWall?: boolean;
  targetPetId?: string | null;
  targetPetName?: string | null;
  sponsorId?: string | null;
}): Promise<SponsorContributionRecord> {
  const normalizedEmail = input.donorEmail.trim().toLowerCase();
  const record: SponsorContributionRecord = {
    id: `con-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sponsorId: input.sponsorId ?? null,
    receiptNumber: input.receiptNumber,
    donorEmail: normalizedEmail,
    donorName: input.donorName.trim(),
    tierId: input.tierId,
    tierName: input.tierName,
    amountMYR: Math.round(input.amountMYR),
    frequency: input.frequency,
    isActive: true,
    displayOnWall: input.displayOnWall ?? false,
    targetPetId: input.targetPetId ?? null,
    targetPetName: input.targetPetName ?? null,
    createdAt: new Date().toISOString(),
  };

  try {
    const row = await prisma.sponsorContribution.create({
      data: {
        sponsorId: record.sponsorId,
        receiptNumber: record.receiptNumber,
        donorEmail: record.donorEmail,
        donorName: record.donorName,
        tierId: record.tierId,
        tierName: record.tierName,
        amountMYR: record.amountMYR,
        frequency: record.frequency,
        isActive: record.isActive,
        displayOnWall: record.displayOnWall,
        targetPetId: record.targetPetId,
        targetPetName: record.targetPetName,
      },
    });
    return toContributionRecord(row as DbContribution);
  } catch (err) {
    // Includes a duplicate-receipt rejection, which is a defect rather than an outage.
    // The pledge still gets a receipt and an audit entry — losing a donation to a
    // technical failure is the one outcome the donation flow is built to avoid — but it
    // must not disappear from the logs as well.
    warnDatabaseFallback("recordContribution", err);
    await ensureInitialized();
    contributions.push(record);
    return record;
  }
}

/**
 * Sponsors who opted in to the public wall, with their full ledger for tier derivation.
 * Returns password hashes, so callers must project to `SponsorWallEntryDTO` before this
 * reaches a page — `@/lib/domain/sponsorAccess` is the only intended caller.
 */
export async function listWallOptInSponsors(): Promise<
  Array<{ sponsor: SponsorRecord; contributions: SponsorContributionRecord[] }>
> {
  try {
    const rows = await prisma.sponsor.findMany({
      where: { displayOnWall: true },
      include: { contributions: true },
    });
    return (rows as Array<DbSponsor & { contributions: DbContribution[] }>).map((row) => ({
      sponsor: toSponsorRecord(row),
      contributions: row.contributions.map(toContributionRecord),
    }));
  } catch (err) {
    warnDatabaseFallback("listWallOptInSponsors", err);
  }

  await ensureInitialized();
  return Array.from(sponsorsByEmail.values())
    .filter((sponsor) => sponsor.displayOnWall)
    .map((sponsor) => ({
      sponsor,
      contributions: contributions.filter((c) => c.sponsorId === sponsor.id),
    }));
}

/** Test-only reset so suites do not leak in-memory state between cases. */
export async function __resetSponsorStoreForTests(): Promise<void> {
  sponsorsByEmail.clear();
  contributions.length = 0;
  isInitialized = false;
  initPromise = null;
  await ensureInitialized();
}
