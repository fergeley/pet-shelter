// Rehearsal for migration.sql and rollback.sql beside this file. 51 checks.
//
// The 20260917_status_enums rehearsal was run the same way and its script was not kept, so its
// twenty-nine checks can only be re-read, never re-run. This one is kept for that reason: a
// reviewer who doubts a claim in migration.sql's header should be able to re-take the
// measurement rather than trust the paragraph.
//
//   npm i --no-save embedded-postgres      # ~100 MB, not a repo dependency; delete after
//   node prisma/migrations/manual/20260922_pets_birth_date/rehearse.mjs
//
// The target is an embedded PostgreSQL this process starts in a temp directory and stops at the
// end, with its connection string built inline below. It resolves nothing from .env.local,
// prisma.config.ts, DATABASE_URL or any other environment, so it cannot reach production or the
// local dev database however this repo is configured -- which is the point of
// tasks/lessons/2026-09-11-a-rehearsal-that-resolves-its-target-from-config-rehearses-nothing.md.
// Set REHEARSAL_PORT to move it off 55433 if that is taken.
//
// The seven Prisma-level checks need a generated client (`npm run db:generate`). Without one
// they are skipped and reported as skipped, and the other forty-four still run.

import { readFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import process from "node:process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const MIGRATION = readFileSync(join(HERE, "migration.sql"), "utf8");
const ROLLBACK = readFileSync(join(HERE, "rollback.sql"), "utf8");

let EmbeddedPostgres, pg;
try {
  ({ default: EmbeddedPostgres } = await import("embedded-postgres"));
  ({ default: pg } = await import("pg"));
} catch {
  console.error("This rehearsal needs `npm i --no-save embedded-postgres`. See the header.");
  process.exit(2);
}

const PORT = Number(process.env.REHEARSAL_PORT || 55433);
const DB_URL = `postgresql://postgres:rehearsal@127.0.0.1:${PORT}/postgres`;

let failures = 0;
let skipped = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "} ${name}${detail ? `  -- ${detail}` : ""}`);
};
const skip = (name, why) => {
  skipped++;
  console.log(`  --   ${name}  -- skipped: ${why}`);
};

// Production's pets, as the schema it was built from declares it (6108d82^): age/ageCategory
// present and NOT NULL, no birthDate, intakeDate as text, status already the PetStatus enum the
// owner applied on 2026-09-18. Every other scalar master's Pet model declares is here, so a
// Prisma select of the current schema differs from this table in exactly the two columns -- if
// it differed in more, P1 below would pass for the wrong reason.
const PROD_SHAPE = `
CREATE TYPE "public"."PetStatus" AS ENUM ('Available','Pending','Adopted','In Rehabilitation');
CREATE TABLE "public"."pets" (
  "id" TEXT PRIMARY KEY,
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
  "galleryImages" TEXT[] NOT NULL DEFAULT '{}',
  "tags" TEXT[] NOT NULL DEFAULT '{}',
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sponsorshipGoalSen" INTEGER
);
CREATE INDEX "pets_species_status_isArchived_idx" ON "public"."pets"("species","status","isArchived");
CREATE INDEX "pets_isArchived_status_idx" ON "public"."pets"("isArchived","status");
`;

// The ten src/data/pets.json animals: id, age prose, intakeDate, and the birthDate that file
// carries. The fourth column is the expectation, and it is an independent one -- that fixture
// was written by hand, long before this SQL, and the SQL was not derived from it.
const petsJson = JSON.parse(readFileSync(join(REPO, "src", "data", "pets.json"), "utf8"));
const FIXTURES = petsJson.map((p) => [p.id, p.age, p.intakeDate, p.birthDate]);

async function seedRow(c, id, age, intake, category = "young") {
  await c.query(
    `INSERT INTO "public"."pets"
       ("id","name","species","breed","age","ageCategory","gender","size","weight",
        "adoptionFee","description","rescueStory","image","intakeDate")
     VALUES ($1,$2,'dog','Mixed',$3,$4,'Male','Medium','12kg','RM250','d','r','/i.jpg',$5)`,
    [id, `Name ${id}`, age, category, intake]
  );
}

async function fresh(c, rows = FIXTURES) {
  await c.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  await c.query(PROD_SHAPE);
  for (const [id, age, intake] of rows) await seedRow(c, id, age, intake);
}

const columns = (c) =>
  c
    .query(
      `SELECT column_name, is_nullable, column_default, data_type
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name='pets' ORDER BY column_name`
    )
    .then((r) => Object.fromEntries(r.rows.map((x) => [x.column_name, x])));

// A failing multi-statement simple query skips the rest of the string, so the file's own COMMIT
// never runs and the session is left holding an aborted transaction. Nothing is committed either
// way; the ROLLBACK here only makes the connection usable for the next check. migration.sql's
// header says the same thing to whoever runs it in the Neon editor.
async function expectFail(c, sql) {
  try {
    await c.query(sql);
    return { failed: false, message: "" };
  } catch (e) {
    try {
      await c.query("ROLLBACK");
    } catch {}
    return { failed: true, message: e.message, code: e.code };
  }
}

const dataDir = mkdtempSync(join(tmpdir(), "pets-birth-date-rehearsal-"));
const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "rehearsal",
  port: PORT,
  persistent: false,
});
await server.initialise();
await server.start();

const c = new pg.Client({ connectionString: DB_URL });
await c.connect();
console.log(`\nTarget: ${DB_URL}  (throwaway, started by this process)`);
console.log(`${(await c.query("select version()")).rows[0].version}\n`);

// ------------------------------------------------------------------ A. the happy path
await fresh(c);
{
  const r = await expectFail(c, `SELECT "id","birthDate" FROM "public"."pets"`);
  check("A1 before: selecting birthDate fails 42703 undefined_column", r.failed && r.code === "42703", r.code || "");
}
{
  const r = await expectFail(
    c,
    `INSERT INTO "public"."pets" ("id","name","species","breed","gender","size","weight",
      "adoptionFee","description","rescueStory","image","intakeDate")
     VALUES ('x','X','dog','M','Male','S','1kg','RM1','d','r','/i','2026-01-01')`
  );
  check("A2 before: insert without age fails 23502 not-null", r.failed && r.code === "23502", r.code || "");
}

await c.query(MIGRATION);
check("A3 migration.sql applies", true);

{
  const cols = await columns(c);
  check(
    "A4 after: birthDate NOT NULL, default '2024-01-01'",
    !!cols.birthDate && cols.birthDate.is_nullable === "NO" && /2024-01-01/.test(cols.birthDate.column_default || "")
  );
  check(
    "A5 after: birthDateIsEstimate NOT NULL, default true",
    !!cols.birthDateIsEstimate && cols.birthDateIsEstimate.is_nullable === "NO" && /true/.test(cols.birthDateIsEstimate.column_default || "")
  );
  check("A6 after: age is nullable", cols.age?.is_nullable === "YES");
  check("A7 after: ageCategory is nullable", cols.ageCategory?.is_nullable === "YES");
}
{
  const r = await c.query(`SELECT "id","age","birthDate","birthDateIsEstimate" FROM "public"."pets" ORDER BY "id"`);
  const expected = Object.fromEntries(FIXTURES.map(([id, , , birth]) => [id, birth]));
  const wrong = r.rows.filter((row) => row.birthDate !== expected[row.id]);
  check(
    "A8 after: every birthDate equals the pets.json value for the same age+intake",
    r.rows.length === FIXTURES.length && wrong.length === 0,
    wrong.length ? JSON.stringify(wrong) : `${r.rows.length}/${FIXTURES.length}`
  );
  check("A9 after: birthDateIsEstimate is true on every row", r.rows.every((x) => x.birthDateIsEstimate === true));
  check("A10 after: every age value is still present", r.rows.every((x) => typeof x.age === "string" && x.age.length > 0));
  check("A11 after: row count unchanged", r.rows.length === FIXTURES.length, String(r.rows.length));
}
{
  const r = await expectFail(
    c,
    `INSERT INTO "public"."pets" ("id","name","species","breed","gender","size","weight",
      "adoptionFee","description","rescueStory","image","intakeDate","birthDate")
     VALUES ('new-1','X','dog','M','Male','S','1kg','RM1','d','r','/i','2026-01-01','2020-01-01')`
  );
  check("A12 after: insert without age now succeeds", !r.failed, r.message);
  await c.query(`DELETE FROM "public"."pets" WHERE "id"='new-1'`);
}

// ------------------------------------------------------- B. idempotence / re-run safety
await c.query(MIGRATION);
check("B1 re-running migration.sql does not error", true);
{
  const r = await c.query(`SELECT "birthDate" FROM "public"."pets" WHERE "id"=$1`, [FIXTURES[0][0]]);
  check("B2 re-run leaves the backfilled dates alone", r.rows[0].birthDate === FIXTURES[0][3], r.rows[0].birthDate);
}
await c.query(`UPDATE "public"."pets" SET "birthDate"='2019-02-02',"birthDateIsEstimate"=false WHERE "id"=$1`, [FIXTURES[0][0]]);
await c.query(MIGRATION);
{
  const r = await c.query(`SELECT "birthDate","birthDateIsEstimate" FROM "public"."pets" WHERE "id"=$1`, [FIXTURES[0][0]]);
  check(
    "B3 re-run does NOT overwrite a date a human corrected through the form",
    r.rows[0].birthDate === "2019-02-02" && r.rows[0].birthDateIsEstimate === false
  );
}

// -------------------------------------------------------- C. refusals: nothing coerced
const REFUSALS = [
  ["C1 unparseable age aborts and names the row", [["bad-1", "unknown", "2026-01-01"]], /bad-1/],
  ["C2 empty age aborts", [["bad-2", "", "2026-01-01"]], /bad-2/],
  ["C3 non-date intakeDate aborts", [["bad-3", "2 years", "not-a-date"]], /bad-3/],
  ["C4 impossible calendar date (2024-02-31) aborts", [["bad-4", "2 years", "2024-02-31"]], /bad-4/],
  ["C5 month 13 aborts rather than raising", [["bad-5", "2 years", "2024-13-01"]], /bad-5/],
  ["C6 implausible age (500 years) aborts", [["bad-6", "500 years", "2026-01-01"]], /not a plausible/],
  ["C7 huge digit run aborts without integer overflow", [["bad-7", "99999999999999 years", "2026-01-01"]], /not a plausible/],
];
for (const [name, rows, expect] of REFUSALS) {
  await fresh(c, [...FIXTURES, ...rows]);
  const r = await expectFail(c, MIGRATION);
  const cols = await columns(c);
  const untouched = !cols.birthDate && cols.age.is_nullable === "NO";
  check(name, r.failed && expect.test(r.message) && untouched, r.failed ? r.message.split("\n")[0] : "did not abort");
}
{
  await fresh(c);
  await c.query(`ALTER TABLE "public"."pets" ALTER COLUMN "age" DROP NOT NULL`);
  await seedRow(c, "bad-8", "2 years", "2026-01-01");
  await c.query(`UPDATE "public"."pets" SET "age"=NULL WHERE "id"='bad-8'`);
  const r = await expectFail(c, MIGRATION);
  check("C8 NULL age aborts and adds no column", r.failed && /bad-8/.test(r.message) && !(await columns(c)).birthDate);
}

// ------------------------------------------------- D. refuses when there is nothing to use
{
  await c.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  await c.query(PROD_SHAPE);
  await c.query(`ALTER TABLE "public"."pets" DROP COLUMN "age"`);
  const r = await expectFail(c, MIGRATION);
  check("D1 no birthDate and no age: refuses instead of defaulting every row", r.failed && /nothing to derive/.test(r.message));
}

// ------------------------------------------------------ E. unit and language coverage
{
  const CASES = [
    ["e-1", "2 tahun", "2026-06-12", "2024-06-12"],
    ["e-2", "3 thn", "2026-06-12", "2023-06-12"],
    ["e-3", "4 bulan", "2026-06-12", "2026-02-12"],
    ["e-4", "6 bln", "2026-06-12", "2025-12-12"],
    ["e-5", "1 year 6 months", "2026-06-12", "2025-06-12"],
    ["e-6", "2y", "2026-06-12", "2024-06-12"],
    ["e-7", "18 months", "2026-06-12", "2024-12-12"],
    ["e-8", "About 3 years old", "2026-06-12", "2023-06-12"],
    ["e-9", "0 months", "2026-06-12", "2026-06-12"],
  ];
  await fresh(c, CASES);
  await c.query(MIGRATION);
  const r = await c.query(`SELECT "id","age","birthDate" FROM "public"."pets" ORDER BY "id"`);
  const wrong = r.rows.filter((row) => row.birthDate !== CASES.find((x) => x[0] === row.id)[3]);
  check("E1 English and Malay units, and years-before-months, derive as the app does", wrong.length === 0, wrong.length ? JSON.stringify(wrong) : `${r.rows.length}/${r.rows.length}`);
}

// ------------------------------------------------------ F. month-end clamping is reported
{
  const CASES = [
    ["f-1", "1 month", "2026-03-31", "2026-02-28"],
    ["f-2", "1 year", "2024-02-29", "2023-02-28"],
    ["f-3", "2 years", "2026-06-12", "2024-06-12"],
  ];
  await fresh(c, CASES);
  const notices = [];
  c.on("notice", (n) => notices.push(n.message));
  await c.query(MIGRATION);
  const got = Object.fromEntries((await c.query(`SELECT "id","birthDate" FROM "public"."pets"`)).rows.map((x) => [x.id, x.birthDate]));
  check("F1 2026-03-31 minus 1 month clamps to 2026-02-28", got["f-1"] === "2026-02-28", got["f-1"]);
  check("F2 2024-02-29 minus 1 year clamps to 2023-02-28", got["f-2"] === "2023-02-28", got["f-2"]);
  const clampNotice = notices.find((n) => /clamped to the end of the month/.test(n)) || "";
  check("F3 both clamped rows are named in a NOTICE", /f-1/.test(clampNotice) && /f-2/.test(clampNotice));
  check("F4 the row that did not clamp is not named", !/f-3/.test(clampNotice));
  c.removeAllListeners("notice");
}

// ---------------------------------------------------------------------- G. rollback
{
  await fresh(c);
  await c.query(MIGRATION);
  await c.query(ROLLBACK);
  const cols = await columns(c);
  check("G1 rollback drops both added columns", !cols.birthDate && !cols.birthDateIsEstimate);
  check("G2 rollback restores NOT NULL on age and ageCategory", cols.age.is_nullable === "NO" && cols.ageCategory.is_nullable === "NO");
  const kept = await c.query(`SELECT count(*)::int n FROM "public"."pets" WHERE "age" IS NOT NULL`);
  check("G3 rollback keeps every age value", kept.rows[0].n === FIXTURES.length, String(kept.rows[0].n));
  await c.query(MIGRATION);
  const after = await c.query(`SELECT "birthDate" FROM "public"."pets" WHERE "id"=$1`, [FIXTURES[0][0]]);
  check("G4 migration.sql applies again cleanly after rollback", after.rows[0].birthDate === FIXTURES[0][3]);
}
{
  await fresh(c);
  await c.query(MIGRATION);
  await c.query(
    `INSERT INTO "public"."pets" ("id","name","species","breed","gender","size","weight",
      "adoptionFee","description","rescueStory","image","intakeDate","birthDate")
     VALUES ('post-1','X','dog','M','Male','S','1kg','RM1','d','r','/i','2026-01-01','2020-01-01')`
  );
  const notices = [];
  c.on("notice", (n) => notices.push(n.message));
  await c.query(ROLLBACK);
  check(
    "G5 rollback with a post-migration NULL-age row leaves age nullable and says so",
    (await columns(c)).age.is_nullable === "YES" && notices.some((n) => /left nullable/.test(n))
  );
  c.removeAllListeners("notice");
}

// ------------------------------------------------------- H. search_path and locking
{
  await fresh(c);
  await c.query(`CREATE SCHEMA IF NOT EXISTS elsewhere`);
  const c2 = new pg.Client({ connectionString: DB_URL });
  await c2.connect();
  await c2.query(`SET search_path TO elsewhere`);
  await c2.query(MIGRATION);
  check("H1 under a foreign search_path the columns still land on public.pets", !!(await columns(c)).birthDate);
  const stray = await c.query(`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='elsewhere'`);
  check("H2 nothing was created in the other schema", stray.rows[0].n === 0, String(stray.rows[0].n));
  await c2.end();
}
{
  await fresh(c);
  const holder = new pg.Client({ connectionString: DB_URL });
  await holder.connect();
  await holder.query("BEGIN");
  await holder.query(`LOCK TABLE "public"."pets" IN ACCESS EXCLUSIVE MODE`);

  const runner = new pg.Client({ connectionString: DB_URL });
  await runner.connect();
  const t0 = Date.now();
  const r = await expectFail(runner, MIGRATION);
  const secs = (Date.now() - t0) / 1000;
  await holder.query("ROLLBACK");
  await holder.end();

  const cols = await columns(c);
  check("H3 with pets held by another transaction it gives up on the lock timeout", r.failed && r.code === "55P03" && secs < 15, `${r.code} after ${secs.toFixed(1)}s`);
  check("H4 and it commits nothing: no column added, age still NOT NULL", !cols.birthDate && cols.age.is_nullable === "NO");
  await runner.query(MIGRATION);
  const after = await c.query(`SELECT "birthDate" FROM "public"."pets" WHERE "id"=$1`, [FIXTURES[0][0]]);
  check("H5 re-running once the lock is free finishes the job", after.rows[0].birthDate === FIXTURES[0][3]);
  await runner.end();
}

// ------------------- K. half of the pair present is refused, not mistaken for "already done"
{
  await fresh(c);
  await c.query(`ALTER TABLE "public"."pets" ADD COLUMN "birthDate" TEXT NOT NULL DEFAULT '2024-01-01'`);
  const r = await expectFail(c, MIGRATION);
  const cols = await columns(c);
  check(
    "K1 birthDate without birthDateIsEstimate is refused, not reported as already migrated",
    r.failed && /birthDateIsEstimate/.test(r.message) && !cols.birthDateIsEstimate,
    r.failed ? r.message.split("\n")[0].slice(0, 110) : "it did not abort"
  );
}
{
  await fresh(c);
  await c.query(`ALTER TABLE "public"."pets" ADD COLUMN "birthDateIsEstimate" BOOLEAN NOT NULL DEFAULT true`);
  const r = await expectFail(c, MIGRATION);
  const cols = await columns(c);
  check(
    "K2 birthDateIsEstimate without birthDate is refused, and no backfill runs",
    r.failed && /birthDate/.test(r.message) && !cols.birthDate,
    r.failed ? r.message.split("\n")[0].slice(0, 110) : "it did not abort"
  );
}

// ---------------------------------- J. the header's own pre-check query, as the owner runs it
{
  const lines = MIGRATION.split("\n");
  const from = lines.findIndex((l) => l.includes('SELECT "id", "name", "age", "intakeDate",'));
  const to = lines.findIndex((l) => l.includes('FROM "public"."pets" ORDER BY 5 DESC, 1;'));
  if (from < 0 || to < from) throw new Error("pre-check block not found in migration.sql header");
  const PRECHECK = lines.slice(from, to + 1).map((l) => l.replace(/^--\s?/, "")).join("\n");

  await fresh(c, [
    ["j-1", "2 years", "2026-06-12"],
    ["j-2", "unknown", "2026-06-12"],
    ["j-3", "2 years", "2024-02-31"],
    ["j-4", "4 months", "2026-06-12"],
    ["j-5", "2 years", "not-a-date"],
  ]);
  const verdict = Object.fromEntries((await c.query(PRECHECK)).rows.map((x) => [x.id, x.verdict]));
  check(
    "J1 the header's pre-check names every row the file would refuse, and no others",
    verdict["j-1"] === "ok: years" &&
      verdict["j-2"] === "unparseable age" &&
      verdict["j-3"] === "bad intakeDate" &&
      verdict["j-4"] === "ok: months" &&
      verdict["j-5"] === "bad intakeDate",
    JSON.stringify(verdict)
  );
  check("J2 the pre-check changes nothing", !(await columns(c)).birthDate);
}

// ------------------------------------------------ I. no scratch table is left behind
{
  const r = await c.query(`SELECT count(*)::int n FROM information_schema.tables WHERE table_name='_pets_birth_backfill'`);
  check("I1 the TEMP scratch table exists nowhere afterwards", r.rows[0].n === 0);
}

// ---------------------------------- P. master's own generated client, before and after
{
  let PrismaClient, PrismaPg;
  try {
    ({ PrismaClient } = await import(`file:///${join(REPO, "node_modules", "@prisma", "client", "default.js").replace(/\\/g, "/")}`));
    ({ PrismaPg } = await import(`file:///${join(REPO, "node_modules", "@prisma", "adapter-pg", "dist", "index.js").replace(/\\/g, "/")}`));
  } catch {
    for (const n of ["P1", "P2", "P3", "P4", "P5", "P6", "P7"]) skip(`${n} Prisma-level check`, "no generated client; run `npm run db:generate`");
  }

  if (PrismaClient) {
    await fresh(c, [FIXTURES[0]]);
    const client = () => new PrismaClient({ adapter: new PrismaPg({ connectionString: DB_URL }) });
    const newPet = {
      name: "New", species: "dog", breed: "Mixed", gender: "Male", size: "Small", weight: "5kg",
      adoptionFee: "RM100", description: "d", rescueStory: "r", image: "/i.jpg", intakeDate: "2026-09-22",
    };

    let p = client();
    try {
      await p.pet.findMany();
      check("P1 before: prisma.pet.findMany fails on a production-shaped pets", false, "it succeeded");
    } catch (e) {
      check("P1 before: prisma.pet.findMany fails on a production-shaped pets", /birthDate/.test(e.message), (e.message.match(/The column [^\n]*/) || [""])[0]);
    }
    try {
      await p.pet.create({ data: { id: "pet-new", ...newPet } });
      check("P2 before: prisma.pet.create fails", false, "it succeeded");
    } catch (e) {
      check("P2 before: prisma.pet.create fails", /birthDate/.test(e.message), (e.message.match(/The column [^\n]*/) || [""])[0]);
    }
    await p.$disconnect();

    await c.query(MIGRATION);

    p = client();
    const rows = await p.pet.findMany();
    check("P3 after: prisma.pet.findMany returns the real row", rows.length === 1 && rows[0].id === FIXTURES[0][0]);
    check("P4 after: the backfilled birthDate is intakeDate minus age", rows[0]?.birthDate === FIXTURES[0][3], rows[0]?.birthDate);
    const created = await p.pet.create({ data: { id: "pet-new", ...newPet, birthDate: "2025-09-22", birthDateIsEstimate: false } });
    check("P5 after: prisma.pet.create succeeds without age/ageCategory", created.id === "pet-new");
    const updated = await p.pet.update({ where: { id: FIXTURES[0][0] }, data: { isArchived: true } });
    check("P6 after: prisma.pet.update (archive) succeeds", updated.isArchived === true);
    await p.$disconnect();

    // Is relaxing age/ageCategory load-bearing, or dead weight in the file? Put the NOT NULL
    // back and ask the same client. Note what Prisma reports: it does not name the column.
    await c.query(`DELETE FROM "public"."pets" WHERE "id"='pet-new'`);
    await c.query(`UPDATE "public"."pets" SET "age"=coalesce("age",'2 years'),"ageCategory"=coalesce("ageCategory",'young')`);
    await c.query(`ALTER TABLE "public"."pets" ALTER COLUMN "age" SET NOT NULL`);
    await c.query(`ALTER TABLE "public"."pets" ALTER COLUMN "ageCategory" SET NOT NULL`);
    p = client();
    try {
      await p.pet.create({ data: { id: "pet-new2", ...newPet, birthDate: "2025-09-22" } });
      check("P7 birthDate alone is not enough: create still fails while age is NOT NULL", false, "it succeeded, so the DROP NOT NULLs are dead weight");
    } catch (e) {
      check("P7 birthDate alone is not enough: create still fails while age is NOT NULL", /null constraint/i.test(e.message) || e.code === "P2011", (e.message.match(/Null constraint[^\n]*/) || [""])[0]);
    }
    await p.$disconnect();
  }
}

console.log(`\n${failures ? `${failures} FAILED` : "all checks passed"}${skipped ? `, ${skipped} skipped` : ""}`);
await c.end();
try {
  await server.stop();
} catch {
  // Windows holds the data directory open briefly; the directory is a mkdtemp under the OS temp
  // dir and is not reused, so a failed teardown is not a failed rehearsal.
}
process.exit(failures ? 1 : 0);
