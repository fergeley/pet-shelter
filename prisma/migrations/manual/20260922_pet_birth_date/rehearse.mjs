/**
 * Rehearses migration.sql, rollback.sql and cleanup.sql beside this file, plus
 * ../20260922_settings_and_defaults/, against an embedded PostgreSQL shaped like production.
 *
 *     npx tsx prisma/migrations/manual/20260922_pet_birth_date/rehearse.mjs
 *
 * `tsx`, not `node`: this file imports `approximateBirthDate` from src/lib/domain/petAge.ts and
 * compares the SQL's output against it row by row. That comparison is the point of the script.
 * The SQL is a transcription of that function, and a transcription is only worth its diff against
 * the original — asserting it against hand-typed constants instead would prove only that the
 * constants and the SQL agree about what the function probably does. Two of the bugs this script
 * caught were exactly that kind: Postgres interval arithmetic clamps a leap-day rollover where
 * JavaScript rolls it forward, and CURRENT_DATE is a day off the JS UTC fallback in Malaysia.
 *
 * Runs entirely in memory. It starts no server, opens no port, reads no .env, and cannot reach
 * production — pglite is PostgreSQL 17 compiled to WASM. It resolves out of the repo's
 * node_modules as a transitive dependency rather than a declared one; if that ever stops being
 * true, `npm i -D @electric-sql/pglite` in a scratch directory and point NODE_PATH at it.
 *
 * `prisma/schema.prisma` is not consulted. PROD_SCHEMA below is deliberately hand-written to be
 * production's shape as measured on 2026-09-18 — text `age`/`ageCategory` NOT NULL, no birthDate,
 * `status` already the PetStatus enum the owner applied on 2026-09-18 — because generating it
 * from the schema would rehearse the destination against itself.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");

const { approximateBirthDate } = await import(
  new URL("../../../../src/lib/domain/petAge.ts", import.meta.url).href
);

const sql = (p) => readFileSync(join(HERE, p), "utf8");
const settingsSql = (p) => readFileSync(join(HERE, "..", "20260922_settings_and_defaults", p), "utf8");

const PET_MIG = sql("migration.sql");
const PET_ROLL = sql("rollback.sql");
const PET_CLEAN = sql("cleanup.sql");
const SET_MIG = settingsSql("migration.sql");
const SET_ROLL = settingsSql("rollback.sql");

const fixtures = JSON.parse(readFileSync(join(REPO, "src", "data", "pets.json"), "utf8"));

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`);
  }
};

const PROD_SCHEMA = `
CREATE TYPE "public"."PetStatus" AS ENUM ('Available', 'Pending', 'Adopted', 'In Rehabilitation');
CREATE TABLE "public"."pets" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "species" TEXT NOT NULL,
  "breed" TEXT NOT NULL,
  "age" TEXT NOT NULL,
  "ageCategory" TEXT NOT NULL,
  "gender" TEXT NOT NULL,
  "size" TEXT NOT NULL,
  "weight" TEXT NOT NULL,
  "status" "public"."PetStatus" NOT NULL DEFAULT 'Available',
  "adoptionFee" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "rescueStory" TEXT NOT NULL,
  "image" TEXT NOT NULL,
  "galleryImages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "intakeDate" TEXT NOT NULL,
  "vaccinated" BOOLEAN NOT NULL DEFAULT true,
  "microchipped" BOOLEAN NOT NULL DEFAULT true,
  "spayedNeutered" BOOLEAN NOT NULL DEFAULT true,
  "specialNeeds" TEXT,
  "customQrUrl" TEXT,
  "rehabStage" TEXT,
  "rehabStageMs" TEXT,
  "rehabProgressPercent" INTEGER,
  "goodWithDogs" BOOLEAN NOT NULL DEFAULT true,
  "goodWithCats" BOOLEAN NOT NULL DEFAULT true,
  "goodWithKids" BOOLEAN NOT NULL DEFAULT true,
  "energyLevel" TEXT NOT NULL DEFAULT 'Moderate',
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sponsorshipGoalSen" INTEGER
);
CREATE INDEX "pets_species_status_isArchived_idx" ON "public"."pets" ("species", "status", "isArchived");
CREATE INDEX "pets_isArchived_status_idx" ON "public"."pets" ("isArchived", "status");
CREATE TABLE "public"."shelter_settings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default-settings',
  "shelterName" TEXT NOT NULL DEFAULT 'Hope for Strays',
  "email" TEXT NOT NULL DEFAULT 'info@hopeforstrays.org',
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "public"."notification_preferences" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "photoUpdates" BOOLEAN NOT NULL DEFAULT true,
  "newsletter" BOOLEAN NOT NULL DEFAULT true,
  "unsubscribedAllAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

// The ten fixture animals plus the rows that decide whether the SQL is a faithful transcription
// rather than an approximation of one. Month-end and leap-day are where Postgres interval
// arithmetic and JavaScript's Date disagree; the last three are where the rule gives up.
const AWKWARD = [
  ["awk-leapday", "1 year", "2024-02-29"],
  ["awk-monthend", "1 month", "2026-03-31"],
  ["awk-monthend2", "1 month", "2026-05-31"],
  ["awk-both", "2 years 3 months", "2026-06-12"],
  ["awk-months18", "18 months", "2026-06-12"],
  ["awk-tightspace", "3y", "2026-01-15"],
  ["awk-capitals", "2 YEARS", "2025-11-30"],
  ["awk-noyearmonth", "Adult", "2026-06-12"],
  ["awk-empty", "", "2026-06-12"],
  ["awk-baddate", "2 years", "not-a-date"],
];

const insertPet = async (db, id, age, intake, band = "adult") =>
  db.query(
    `INSERT INTO "public"."pets" ("id","name","species","breed","age","ageCategory","gender","size",
       "weight","adoptionFee","description","rescueStory","image","intakeDate","updatedAt")
     VALUES ($1,'n','dog','b',$2,$3,'Male','Small','1kg','Free','d','r','i',$4, CURRENT_TIMESTAMP)`,
    [id, age, band, intake]
  );

const cols = async (db, table) =>
  (
    await db.query(
      `SELECT column_name, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1`,
      [table]
    )
  ).rows;
const byName = (cs) => new Map(cs.map((c) => [c.column_name, c]));

async function freshDb() {
  const db = new PGlite();
  await db.exec(PROD_SCHEMA);
  return db;
}

// --- Scenario 1: the full forward / rollback / re-apply round trip -----------------------------

const db = await freshDb();
const rows = [
  ...fixtures.map((p) => [p.id, p.age, p.intakeDate, p.ageCategory]),
  ...AWKWARD.map(([id, age, intake]) => [id, age, intake, "adult"]),
];
for (const [id, age, intake, band] of rows) await insertPet(db, id, age, intake, band);

const before = await db.query(`SELECT "id","age","ageCategory","intakeDate" FROM "public"."pets"`);
const beforeById = new Map(before.rows.map((r) => [r.id, r]));

console.log(`\n== 1. forward migration (${rows.length} pets: ${fixtures.length} fixture + ${AWKWARD.length} awkward)`);
await db.exec(PET_MIG);
let pc = byName(await cols(db, "pets"));
check("pets.age dropped", !pc.has("age"));
check("pets.ageCategory dropped", !pc.has("ageCategory"));
check("pets.birthDate NOT NULL", pc.get("birthDate")?.is_nullable === "NO");
check(
  "pets.birthDate default is '2024-01-01', matching schema.prisma",
  String(pc.get("birthDate")?.column_default ?? "").includes("2024-01-01")
);
check("pets.birthDateIsEstimate NOT NULL", pc.get("birthDateIsEstimate")?.is_nullable === "NO");
check(
  "pets.birthDateIsEstimate default true",
  String(pc.get("birthDateIsEstimate")?.column_default ?? "").includes("true")
);

console.log("\n== 2. every derived date equals src/lib/domain/petAge.ts");
const after = await db.query(`SELECT "id","birthDate","birthDateIsEstimate" FROM "public"."pets"`);
const mismatches = [];
for (const r of after.rows) {
  const o = beforeById.get(r.id);
  const expected = approximateBirthDate(o.age, o.intakeDate).birthDate;
  if (r.birthDate !== expected) {
    mismatches.push(`${r.id}: age=${JSON.stringify(o.age)} intake=${o.intakeDate} sql=${r.birthDate} js=${expected}`);
  }
}
check(`all ${after.rows.length} derived dates equal approximateBirthDate()`, mismatches.length === 0, mismatches.join(" | "));
check("every row flagged an estimate", after.rows.every((r) => r.birthDateIsEstimate === true));
const defaulted = after.rows.filter(
  (r) => r.birthDate === "2024-01-01" && beforeById.get(r.id).intakeDate !== "2024-01-01"
);
check("no row received the 2024-01-01 column default", defaulted.length === 0, defaulted.map((r) => r.id).join(","));

const archive = await db.query(`SELECT * FROM "public"."pets_age_archive_20260922"`);
check(`archive holds all ${rows.length} rows`, archive.rows.length === rows.length, String(archive.rows.length));
check(
  "archive preserved age and ageCategory verbatim",
  archive.rows.every((a) => {
    const o = beforeById.get(a.id);
    return a.age === o.age && a.ageCategory === o.ageCategory;
  })
);
check(
  "ageParsed flags exactly the unreadable rows",
  JSON.stringify(archive.rows.filter((a) => !a.ageParsed).map((a) => a.id).sort()) ===
    JSON.stringify(["awk-baddate", "awk-empty", "awk-noyearmonth"])
);

console.log("\n== 3. re-running the forward migration is a no-op");
await db.exec(PET_MIG);
const twice = await db.query(`SELECT "id","birthDate" FROM "public"."pets"`);
const byIdOnce = new Map(after.rows.map((r) => [r.id, r.birthDate]));
check("second run changed no birth date", twice.rows.every((r) => byIdOnce.get(r.id) === r.birthDate));

console.log("\n== 4. a pet created after the conversion, then rollback");
await db.query(
  `INSERT INTO "public"."pets" ("id","name","species","breed","birthDate","birthDateIsEstimate","gender","size",
     "weight","adoptionFee","description","rescueStory","image","intakeDate","updatedAt")
   VALUES ('post-migration','n','dog','b','2023-01-10',false,'Male','Small','1kg','Free','d','r','i','2026-09-20', CURRENT_TIMESTAMP)`
);
await db.exec(PET_ROLL);
pc = byName(await cols(db, "pets"));
check("rollback restored age NOT NULL", pc.has("age") && pc.get("age").is_nullable === "NO");
check("rollback restored ageCategory", pc.has("ageCategory"));
check("rollback dropped birthDate", !pc.has("birthDate"));
check("rollback dropped birthDateIsEstimate", !pc.has("birthDateIsEstimate"));
const restored = await db.query(`SELECT "id","age","ageCategory" FROM "public"."pets"`);
check(
  "every original age and band came back verbatim",
  restored.rows
    .filter((r) => r.id !== "post-migration")
    .every((r) => r.age === beforeById.get(r.id).age && r.ageCategory === beforeById.get(r.id).ageCategory)
);
const post = restored.rows.find((r) => r.id === "post-migration");
check(
  "the post-migration pet got a synthesised age as of its intake",
  post.age === "3 years" && post.ageCategory === "adult",
  `${post.age} / ${post.ageCategory}`
);

console.log("\n== 5. forward again restores birth dates exactly, the new pet's included");
await db.exec(PET_MIG);
const again = new Map(
  (await db.query(`SELECT "id","birthDate","birthDateIsEstimate" FROM "public"."pets"`)).rows.map((r) => [
    r.id,
    r,
  ])
);
check("round trip preserved every original birth date", after.rows.every((r) => again.get(r.id)?.birthDate === r.birthDate));
check(
  "a human-entered birth date survived the round trip",
  again.get("post-migration")?.birthDate === "2023-01-10",
  String(again.get("post-migration")?.birthDate)
);
// The flag is the point of the checkbox, and it has its own way of being lost: the archive has to
// carry it, or the re-apply stamps every restored row `true` and a known birthday silently becomes
// an estimate. Review found exactly that; this is the assertion that would have caught it.
check(
  "a known birthday did NOT get demoted to an estimate by the round trip",
  again.get("post-migration")?.birthDateIsEstimate === false,
  String(again.get("post-migration")?.birthDateIsEstimate)
);
check(
  "and the backfilled rows are still estimates",
  after.rows.every((r) => again.get(r.id)?.birthDateIsEstimate === true)
);

console.log("\n== 6. cleanup, then rollback refuses rather than inventing");
await db.exec(PET_CLEAN);
check(
  "cleanup.sql dropped the archive",
  (await db.query(
    `SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema='public' AND table_name='pets_age_archive_20260922'`
  )).rows[0].n === 0
);
let refusal = "";
try {
  await db.exec(PET_ROLL);
} catch (err) {
  refusal = String(err?.message ?? err);
  await db.exec("ROLLBACK").catch(() => {});
}
check("rollback aborts once the archive is gone", /refusing to invent them/.test(refusal), refusal);
check("and left birthDate untouched", byName(await cols(db, "pets")).has("birthDate"));

console.log("\n== 7. settings and defaults migration");
await db.exec(SET_MIG);
let sc = byName(await cols(db, "shelter_settings"));
check(
  "all seven shelter_settings columns added",
  ["resendApiKey", "emailFrom", "storageProvider", "s3Bucket", "s3Region", "s3Endpoint", "cloudinaryCloudName"].every(
    (c) => sc.has(c)
  )
);
check(
  "notification_preferences.updatedAt default dropped",
  byName(await cols(db, "notification_preferences")).get("updatedAt").column_default === null
);
const settingsBefore = JSON.stringify(await cols(db, "shelter_settings"));
await db.exec(SET_MIG);
check(
  "settings migration re-runs as a no-op",
  JSON.stringify(await cols(db, "shelter_settings")) === settingsBefore
);
await db.exec(SET_ROLL);
sc = byName(await cols(db, "shelter_settings"));
check("settings rollback removed the columns", !sc.has("cloudinaryCloudName") && !sc.has("emailFrom"));
check(
  "settings rollback restored the updatedAt default",
  String(byName(await cols(db, "notification_preferences")).get("updatedAt").column_default ?? "")
    .toUpperCase()
    .includes("CURRENT_TIMESTAMP")
);
await db.exec(SET_MIG);
check(
  "settings migration applies again after rollback",
  JSON.stringify(await cols(db, "shelter_settings")) === settingsBefore
);
await db.close();

// --- Scenario 2: the refusals, each on its own database, because each aborts the file ----------

console.log("\n== 8. refusals name the offending animals and change nothing");

const REFUSALS = [
  ["an intakeDate that is not a real day", "2 years", "2024-02-31", /not a real calendar day.*bad-row/s],
  ["a month of 13", "2 years", "2024-13-01", /not a real calendar day.*bad-row/s],
  ["an age no animal has", "500 years", "2026-06-12", /age no animal has.*bad-row/s],
  ["an age too large for an integer", "99999999999999 years", "2026-06-12", /age no animal has.*bad-row/s],
  ["720 months exceeded", "900 months", "2026-06-12", /age no animal has.*bad-row/s],
];

for (const [label, age, intake, pattern] of REFUSALS) {
  const d = await freshDb();
  await insertPet(d, "good-row", "2 years", "2026-06-12");
  await insertPet(d, "bad-row", age, intake);
  let message = "";
  try {
    await d.exec(PET_MIG);
  } catch (err) {
    message = String(err?.message ?? err);
    await d.exec("ROLLBACK").catch(() => {});
  }
  check(`refuses ${label}, naming the row`, pattern.test(message), message || "no error raised");
  const c = byName(await cols(d, "pets"));
  check(`  ...and leaves pets untouched after refusing ${label}`, c.has("age") && !c.has("birthDate"));
  await d.close();
}

// A boundary that must NOT be refused, or the guard is merely stricter, not more correct.
const edge = await freshDb();
await insertPet(edge, "sixty", "60 years", "2026-06-12");
await insertPet(edge, "leap-ok", "1 year", "2024-02-29");
await edge.exec(PET_MIG);
const edgeRows = new Map(
  (await edge.query(`SELECT "id","birthDate" FROM "public"."pets"`)).rows.map((r) => [r.id, r.birthDate])
);
check(
  "60 years is accepted, not refused, and still derives as the app derives",
  edgeRows.get("sixty") === approximateBirthDate("60 years", "2026-06-12").birthDate,
  `${edgeRows.get("sixty")} vs ${approximateBirthDate("60 years", "2026-06-12").birthDate}`
);
check(
  "a real leap day is still accepted and rolls as the app rolls",
  edgeRows.get("leap-ok") === approximateBirthDate("1 year", "2024-02-29").birthDate,
  `${edgeRows.get("leap-ok")} vs ${approximateBirthDate("1 year", "2024-02-29").birthDate}`
);
await edge.close();

// --- Scenario 3: someone already stopped the read storm by hand ------------------------------
//
// The emergency fix for the 42703 storm is `db push`'s own statement minus the drops. It leaves
// `age` in place and every row on the invented 2024-01-01. Without a guard this file derives every
// date, archives it, discards it and drops `age` anyway, reporting success. Found by review.

console.log("\n== 9. refuses a table where birthDate was already filled in by hand");
const patched = await freshDb();
await insertPet(patched, "p1", "2 years", "2026-06-12");
await insertPet(patched, "p2", "1 year", "2020-03-04");
await patched.exec(
  `ALTER TABLE "public"."pets"
     ADD COLUMN "birthDate" TEXT NOT NULL DEFAULT '2024-01-01',
     ADD COLUMN "birthDateIsEstimate" BOOLEAN NOT NULL DEFAULT true;`
);
let patchedErr = "";
try {
  await patched.exec(PET_MIG);
} catch (err) {
  patchedErr = String(err?.message ?? err);
  await patched.exec("ROLLBACK").catch(() => {});
}
check("refuses rather than discarding the derived dates", /already have a birthDate/.test(patchedErr), patchedErr);
const patchedCols = byName(await cols(patched, "pets"));
check("  ...and leaves age in place", patchedCols.has("age") && patchedCols.has("ageCategory"));
check(
  "  ...and no row was silently left on 2024-01-01 with age gone",
  (await patched.query(`SELECT count(*)::int AS n FROM "public"."pets" WHERE "birthDate" = '2024-01-01'`))
    .rows[0].n === 2 && patchedCols.has("age")
);

// The remediation the error's HINT gives must actually work.
await patched.exec(`ALTER TABLE "public"."pets" ALTER COLUMN "birthDate" DROP NOT NULL;`);
await patched.exec(`UPDATE "public"."pets" SET "birthDate" = NULL;`);
await patched.exec(PET_MIG);
const healed = new Map(
  (await patched.query(`SELECT "id","birthDate" FROM "public"."pets"`)).rows.map((r) => [r.id, r.birthDate])
);
check(
  "the HINT's remediation lets the file proceed and derive correctly",
  healed.get("p1") === approximateBirthDate("2 years", "2026-06-12").birthDate &&
    healed.get("p2") === approximateBirthDate("1 year", "2020-03-04").birthDate,
  `${healed.get("p1")} / ${healed.get("p2")}`
);
await patched.close();

console.log(`\n=== ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
