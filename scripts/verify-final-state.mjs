import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const tables = await pool.query(
  "select table_name from information_schema.tables where table_schema='public' order by 1"
);
console.log("tables:", tables.rows.map((r) => r.table_name).join(", "));

const rows = await pool.query(
  'select category, "displayOrder", "isPublished", left(question, 58) q from "faqs" order by category, "displayOrder"'
);
console.log(`\nfaqs (${rows.rows.length} rows):`);
for (const r of rows.rows) {
  console.log(
    `  ${r.category.padEnd(13)} #${String(r.displayOrder).padEnd(2)} pub=${String(r.isPublished).padEnd(5)} ${r.q}`
  );
}

const stray = await pool.query(
  `select count(*)::int n from "faqs" where question ilike '%E2E probe%' or question ilike '%injection attempt%'`
);
console.log("\nleftover probe/injection rows:", stray.rows[0].n);

const missingMs = await pool.query(
  `select count(*)::int n from "faqs" where "questionMs" is null or "answerMs" is null`
);
console.log("rows missing a Malay translation:", missingMs.rows[0].n);

const audit = await pool.query(
  `select action, count(*)::int n from "audit_logs" where "targetEntity"='Faq' group by action order by action`
);
console.log("\nFAQ audit log entries:");
for (const r of audit.rows) console.log(`  ${r.action.padEnd(20)} ${r.n}`);

await pool.end();
