// One-off: applies prisma/migrations/manual/20260902_add_faq/migration.sql.
// Prints the table list before and after so the blast radius is visible.
import "dotenv/config";
import { Pool } from "pg";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

async function tables() {
  const r = await pool.query(
    "select table_name from information_schema.tables where table_schema='public' order by 1"
  );
  return r.rows.map((x) => x.table_name);
}

try {
  const before = await tables();
  console.log("TABLES BEFORE :", before.join(", ") || "(none)");

  const sql = fs.readFileSync(
    "prisma/migrations/manual/20260902_add_faq/migration.sql",
    "utf8"
  );

  await pool.query("BEGIN");
  await pool.query(sql);
  await pool.query("COMMIT");
  console.log("MIGRATION      : applied and committed");

  const after = await tables();
  console.log("TABLES AFTER  :", after.join(", "));

  const added = after.filter((t) => !before.includes(t));
  const removed = before.filter((t) => !after.includes(t));
  console.log("ADDED         :", added.join(", ") || "(none)");
  console.log("REMOVED       :", removed.join(", ") || "(none)");

  const cols = await pool.query(
    "select column_name, data_type, is_nullable from information_schema.columns where table_name='faqs' order by ordinal_position"
  );
  console.log("faqs COLUMNS  :");
  for (const c of cols.rows) {
    console.log(`  ${c.column_name.padEnd(14)} ${c.data_type.padEnd(28)} null=${c.is_nullable}`);
  }

  const count = await pool.query('select count(*)::int as n from "faqs"');
  console.log("faqs ROWS     :", count.rows[0].n);
} catch (e) {
  await pool.query("ROLLBACK").catch(() => {});
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
