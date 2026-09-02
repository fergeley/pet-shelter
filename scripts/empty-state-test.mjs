/**
 * Proves that unpublishing content actually empties the public surfaces,
 * instead of the bundled seed FAQs reappearing.
 *
 * The old code treated a successful query returning zero rows as a database
 * outage, so an admin could never take the FAQ page down: unpublishing
 * everything resurrected all 15 launch entries, including any copy that had
 * been deliberately retracted.
 *
 * This briefly unpublishes live rows. Every path restores them, and the
 * restore is verified before the script exits.
 */
import { createPool } from "./lib/db.mjs";

const BASE = process.env.E2E_BASE || "http://localhost:3459";
const pool = createPool();

let passed = 0;
let failed = 0;
const check = (label, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? "  -- " + detail : ""}`);
  }
};

const get = async (path) => {
  const r = await fetch(`${BASE}${path}`, { cache: "no-store" });
  return r.text();
};

// Any seeded sentence that only ever comes from the bundled content.
const SEED_MARKER = "All of our adoptions are free of charge";
const TNRM_MARKER = "Trap-Neuter-Release-Manage";

let published = [];

try {
  const before = await pool.query('select id from "faqs" where "isPublished" = true');
  published = before.rows.map((r) => r.id);
  console.log(`\nBaseline: ${published.length} published FAQs`);

  console.log("\n1. Unpublishing only the ADOPTION category");
  await pool.query(
    `update "faqs" set "isPublished" = false where category = 'ADOPTION'`
  );
  {
    const pets = await get("/pets");
    check(
      "/pets no longer shows the bundled adoption answers",
      !pets.includes(SEED_MARKER)
    );
    check(
      "/pets drops the FAQ heading entirely rather than falling back",
      !pets.includes("Soalan Lazim Mengenai Adopsi") &&
        !pets.includes("See all frequently asked questions")
    );

    const faq = await get("/faq");
    check("/faq still shows the other categories", faq.includes(TNRM_MARKER));
    check("/faq no longer shows adoption content", !faq.includes(SEED_MARKER));
  }

  console.log("\n2. Unpublishing every FAQ");
  await pool.query(`update "faqs" set "isPublished" = false`);
  {
    const faq = await get("/faq");
    check("/faq does not resurrect the bundled seed content", !faq.includes(SEED_MARKER));
    check("/faq does not resurrect the TNRM answer either", !faq.includes(TNRM_MARKER));
    check(
      "/faq renders its empty state",
      faq.includes("No answers matched") || faq.includes("0 questions answered"),
      "neither empty-state string found"
    );

    const pets = await get("/pets");
    check("/pets shows no FAQ section at all", !pets.includes(SEED_MARKER));
  }
} catch (e) {
  failed++;
  console.error("UNEXPECTED ERROR:", e.message);
} finally {
  if (published.length > 0) {
    await pool.query(`update "faqs" set "isPublished" = false`);
    const r = await pool.query(
      `update "faqs" set "isPublished" = true where id = any($1::text[])`,
      [published]
    );
    const after = await pool.query(
      'select count(*)::int n from "faqs" where "isPublished" = true'
    );
    const restored = after.rows[0].n === published.length;
    console.log(
      `\nrestore: ${r.rowCount} row(s) republished, now ${after.rows[0].n}/${published.length}` +
        (restored ? " — verified" : " — MISMATCH")
    );
    if (!restored) {
      failed++;
      console.error("!! publication state NOT fully restored — check the faqs table");
    }
  }
  await pool.end();
}

console.log(`\n================  ${passed} passed, ${failed} failed  ================`);
process.exit(failed === 0 ? 0 : 1);
