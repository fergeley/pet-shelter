import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, disconnectPrisma } from "@/lib/server/prisma";
import petsData from "@/data/pets.json";
import { fromDbPetStatus } from "@/lib/server/petMappers";
import {
  requireDatabaseUrl,
  assertDatabaseReachable,
  isDatabaseReady,
} from "./support/database";

/**
 * Proves that `npm run db:push:local` actually produced the schema the Prisma file
 * declares, and that `npm run db:seed:local` round-trips the fixtures unchanged.
 *
 * The distinction this tier exists for: a declared column and a pushed column are
 * not the same thing. `Donation`, `ReceiptSequence`, and the three `rehab*` columns
 * were added to `prisma/schema.prisma` without ever being pushed to a real server,
 * and nothing in Tiers 1–2 could notice — the repository layer falls back to JSON
 * fixtures, so a missing table reads as "offline" rather than "broken".
 */

/** Pet id → the id column, kept explicit so a fixture rename fails loudly here. */
const REHAB_FIXTURES = petsData.filter((p) => {
  const rehab = p as { rehabStage?: string };
  return typeof rehab.rehabStage === "string" && rehab.rehabStage.length > 0;
});

const PROBE_PET_ID = "probe-pet-rehab-roundtrip";

beforeAll(async () => {
  requireDatabaseUrl();
  await assertDatabaseReachable();
});

afterAll(async () => {
  // Guarded so an unreachable database reports the one real error from beforeAll
  // rather than burying it under a failed cleanup.
  if (isDatabaseReady()) {
    await prisma.pet.deleteMany({ where: { id: PROBE_PET_ID } });
  }
  await disconnectPrisma();
});

describe("pushed schema", () => {
  it("has the rehabilitation columns on pets", async () => {
    const columns = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'pets'
        AND column_name IN ('rehabStage', 'rehabStageMs', 'rehabProgressPercent')
    `;

    const byName = Object.fromEntries(columns.map((c) => [c.column_name, c.data_type]));
    expect(byName).toMatchObject({
      rehabStage: "text",
      rehabStageMs: "text",
      rehabProgressPercent: "integer",
    });
  });

  it("has the donation ledger tables", async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('donations', 'receipt_sequences')
    `;

    expect(tables.map((t) => t.table_name).sort()).toEqual([
      "donations",
      "receipt_sequences",
    ]);
  });

  it("enforces the composite receipt-serial uniqueness as a real index", async () => {
    // Declared as @@unique([sequenceScope, sequenceValue]). A declaration that was
    // never pushed would leave the ledger relying on application-level checks it
    // does not perform.
    const indexes = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'donations'
    `;

    // Checked per definition rather than against the joined string: matching
    // across newlines would need the `s` flag, which this tree's ES2017 target
    // does not allow, and a per-row check is the more honest assertion anyway.
    const defs = indexes.map((i) => i.indexdef);
    const isUnique = (d: string) => d.startsWith("CREATE UNIQUE INDEX");

    expect(
      defs.some(
        (d) => isUnique(d) && d.includes("sequenceScope") && d.includes("sequenceValue")
      ),
      `no unique index on (sequenceScope, sequenceValue); found:\n${defs.join("\n")}`
    ).toBe(true);
    expect(
      defs.some((d) => isUnique(d) && d.includes("receiptNumber")),
      `no unique index on receiptNumber; found:\n${defs.join("\n")}`
    ).toBe(true);
  });
});

describe("rehabilitation columns", () => {
  it("round-trips a written value unchanged", async () => {
    // Self-contained rather than dependent on the seed, so this still proves the
    // column works on a pushed-but-unseeded database.
    await prisma.pet.create({
      data: {
        id: PROBE_PET_ID,
        name: "Probe",
        species: "dog",
        breed: "Mixed",
        birthDate: "2024-01-01",
        birthDateIsEstimate: true,
        gender: "Female",
        size: "Medium",
        weight: "12 kg",
        status: "In_Rehabilitation",
        adoptionFee: "Free",
        description: "Schema probe.",
        rescueStory: "Schema probe.",
        image: "/images/placeholder.jpg",
        intakeDate: "2026-01-01",
        rehabStage: "Stage 2: Orthopaedic Recovery & Hydrotherapy",
        rehabStageMs: "Peringkat 2: Pemulihan Ortopedik & Hidroterapi",
        rehabProgressPercent: 55,
      },
    });

    const row = await prisma.pet.findUnique({ where: { id: PROBE_PET_ID } });
    expect(row?.rehabStage).toBe("Stage 2: Orthopaedic Recovery & Hydrotherapy");
    // Non-ASCII must survive the round trip; a mis-encoded column corrupts the
    // Malay copy silently rather than throwing.
    expect(row?.rehabStageMs).toBe("Peringkat 2: Pemulihan Ortopedik & Hidroterapi");
    expect(row?.rehabProgressPercent).toBe(55);
  });

  it("leaves rehab columns null for pets that are not under care", async () => {
    const available = await prisma.pet.findFirst({
      where: { status: "Available", id: { not: PROBE_PET_ID } },
    });

    // Only meaningful once the fixtures are seeded; the seed assertion below is
    // what enforces that they are.
    if (available) {
      expect(available.rehabStage).toBeNull();
      expect(available.rehabProgressPercent).toBeNull();
    }
  });
});

describe("seeded fixtures", () => {
  it("has fixtures carrying rehabilitation data to verify", () => {
    // Guards the two assertions below from silently degrading into no-ops if the
    // fixtures lose their rehab payload.
    expect(REHAB_FIXTURES.length).toBeGreaterThanOrEqual(2);
    expect(REHAB_FIXTURES.map((p) => p.id)).toEqual(
      expect.arrayContaining(["pet-009", "pet-010"])
    );
  });

  it("round-trips every rehabilitation fixture through Postgres unchanged", async () => {
    const seeded = await prisma.pet.findMany({
      where: { id: { in: REHAB_FIXTURES.map((p) => p.id) } },
    });

    if (seeded.length === 0) {
      throw new Error(
        [
          "No fixture pets found in the database, so the seed round-trip cannot be verified.",
          "",
          "  npm run db:push:local && npm run db:seed:local",
        ].join("\n")
      );
    }

    expect(seeded).toHaveLength(REHAB_FIXTURES.length);

    for (const fixture of REHAB_FIXTURES) {
      const rehab = fixture as {
        rehabStage?: string;
        rehabStageMs?: string;
        rehabProgressPercent?: number;
      };
      const row = seeded.find((p) => p.id === fixture.id);

      expect(row, `pet ${fixture.id} missing from the database`).toBeDefined();
      expect(row?.rehabStage).toBe(rehab.rehabStage);
      expect(row?.rehabStageMs).toBe(rehab.rehabStageMs);
      expect(row?.rehabProgressPercent).toBe(rehab.rehabProgressPercent);
      // Through the mapper, not against the raw column. `PetStatus` declares
      // `In_Rehabilitation @map("In Rehabilitation")`, so Postgres holds the
      // spaced string while the Prisma client hands back the identifier — a
      // direct comparison against the fixture can never pass for a rehab pet.
      // Asserting through `fromDbPetStatus` is also the stronger claim: it is
      // the projection the repository actually reads rows with.
      expect(fromDbPetStatus(row!.status)).toBe(fixture.status);
    }
  });

  it("seeds the nested pet history the fixtures declare", async () => {
    // The seed clears and re-creates these rows by fixture id, so a broken cascade
    // or a renamed relation shows up as a count mismatch rather than a crash.
    const withHistory = petsData.filter((p) => {
      const h = p as unknown as { updates?: unknown[]; medicalTimeline?: unknown[] };
      return (h.updates?.length ?? 0) > 0 || (h.medicalTimeline?.length ?? 0) > 0;
    });

    for (const fixture of withHistory) {
      const h = fixture as unknown as {
        updates?: unknown[];
        medicalTimeline?: unknown[];
      };

      const [updates, timeline] = await Promise.all([
        prisma.petUpdate.count({ where: { petId: fixture.id } }),
        prisma.medicalTimelineEvent.count({ where: { petId: fixture.id } }),
      ]);

      expect(updates, `updates for ${fixture.id}`).toBe(h.updates?.length ?? 0);
      expect(timeline, `timeline for ${fixture.id}`).toBe(h.medicalTimeline?.length ?? 0);
    }
  });
});
